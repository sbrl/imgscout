#!/usr/bin/env python3
import sys
import json
import os
from time import perf_counter as pc

# from PIL import Image # TODO USE THIS AS FALLBACK
# import simplejpeg # TODO USE THIS AS FALLBACK
import torch
import torchvision
import clip # TODO use smaller quantised CLIP
# Consider https://github.com/mlfoundations/open_clip

from CLIPImageDataset import CLIPImageDataset

image_size = int(os.environ("IMAGE_SIZE")) if "IMAGE_SIZE" in os.environ else 224 # TODO DETERMINE THIS AUTOMAGICALLY. ALL SETTABLE PARAMS SHOULD BE PASSED VIA initialise() - TODO REFACTOR TO ENV VARS!

def send_raw(payload: str) -> None:
	sys.stdout.write(payload + "\n")
def send_id(msgid: str, event: str, data: dict) -> None:
	# IMPORTANT: Use ONLY this function when reporting results of jobs!
	payload = json.dumps({
		"msgid": msgid,
		"event": event,
		"data": data,
	})
	send_raw(payload)
def send_simple(event: str, data: dict | str) -> None:
	send_raw(json.dumps({
		"event": event,
		"data": data
	}))

send_simple("log", {
	"versions": {
		"python": sys.version,
		"torch": torch.__version__,
		"torchvision": torchvision.__version__,
		"clip": clip.available_models()
	}
})

def msgid(obj: dict) -> str:
	return obj["msgid"] or ""

##########################################################################


def initialise(model_clip: str = "ViT-L/14", in_device: str = "cpu", in_batch_size: int = 64) -> None:
	global model, device, batch_size
	
	start = pc()
	device = in_device
	model, _preprocess = clip.load(model_clip, device=device)
	batch_size = in_batch_size
	
	send_simple("log", f"Init complete of {model_clip} on {device} in {pc()-start:.2f}s")
	
	# TODO import & adapt CLIPImageDataset

def load_images(
    filepaths: list[str]
) -> (torch.utils.data.Dataset, torch.utils.data.DataLoader):
    # All preprocessing hasta be done on the CPU 'cause otherwise we get crashes like "RuntimeError: Cannot re-initialize CUDA in forked subprocess. To use CUDA with multiprocessing, you must use the 'spawn' start method" and other sadness.
    # NOTE GPU-accelerated image decoding may be worth a look in the future. Empirical evidence: time_decode=0.65s, time_ai=0.24s for 2xPNGs, CUDA on mobile nvidia 3060
    ds = CLIPImageDataset(filepaths, device="cpu", image_size=image_size)
    dl = torch.utils.data.DataLoader(
        ds, batch_size=batch_size, num_workers=os.cpu_count()
    )
    return ds, dl

def clipify_image(msgid: str, filepaths: list[str]) -> None:
	global model, device
	# TODO clipificate the filepaths (doing everything in parallel where possible) and return here
	# TODO rewrite this to native 
	
	# images = torch.stack(images).to(device)
	ds, dl = load_images(filepaths)
	with torch.no_grad():
		last = pc()
		for i, batch in enumerate(dl):
			after_decode = pc()
			time_decode = after_decode - last
			image_features = model.encode_image(batch.to(device))
			time_ai = pc() - after_decode
			now = pc()
			send_id(msgid, "clipify-image", { # ID keeps everything organised & reduces data back & forth
				"vectors": image_features.tolist(), # Should correspond 1:1 w/filepaths
				"batch_index": i,
				"time": now - last, # ...in seconds
				"time_decode": round(time_decode, 2),
				"time_ai": round(time_ai, 2),
			})
			last = now

 
	pass

def clipify_text(msgid: str, text: str | list[str]) -> None:
	if text is str:
		text = [text]
	
	start = pc()
	
	tokens = clip.tokenize(text).to(device)
	with torch.no_grad():
		embedded = model.encode_text(tokens).tolist()
	
	end = pc()
	
	send_id(msgid, "clipify-text", {
		"vectors": embedded, # should be 1:1 w/input etc
		"time": round(end - start, 2) # ....in seconds
	})


##########################################################################

if "SBRL_DEMO_MODE" in os.environ:
    print(">>> DEMO MODE ACTIVATED")
    # NOTE: setting device="cuda" also supports ROCm/AMD devices, ref <https://discuss.pytorch.org/t/how-to-run-torch-with-amd-gpu/157069/6>
    initialise(in_device="cuda" if torch.cuda.is_available() else "cpu")

    print(">>> DEBUG:demo clipify_image")
    imgs = ["/tmp/x/test.png", "/tmp/x/test.png"]
    print(clipify_image("testid", imgs))

    print(">>> DEBUG:demo clipify_text")
    txt = ["a photo of a cat", "a beautiful sunset"]
    print(clipify_text("testid", txt))
else:
	send_simple("log", {
		"msg": "Initialising worker",
		"pid": os.getpid()
	})
	for line in sys.stdin:
		obj = json.loads(line)
		match obj["event"]:
			case "start":
				initialise(
					model_clip=obj["data"]["model_clip"],
					device=obj["data"]["device"],
					batch_size=obj["data"]["batch_size"]
				)
			case "clipify-image":
				clipify_image(msgid(obj), obj["data"]["filepaths"])
			case "clipify-text":
				clipify_text(msgid(obj), obj["data"]["text"])
