import sys
import json

import torch
import clip  # TODO use smaller quantised CLIP
# Consider https://github.com/mlfoundations/open_clip

def send_raw(payload: str) -> None:
    sys.stdout.write(payload)
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
            "clip": clip.__version__
            }
})

def msgid(obj: dict) -> str:
    return obj["msgid"] or ""

##########################################################################


def initialise(model_clip: str, in_device: str = "cpu") -> None:
    global model, device

    device = in_device
    model, _preprocess = clip.load(model_clip, device=device)
    # TODO import & adapt CLIPImageDataset


def clipify_image(msgid: str, filepaths: list[str]) -> None:
    # TODO clipificate the filepaths (doing everything in parallel where possible) and return here
    pass

def clipify_text(msgid: str, text: str | list[str]) -> None:
    if text is str:
        text = [text]
    tokens = clip.tokenize(text).to(device)
    with torch.no_grad():
        embedded = model.encode_text(tokens).tolist()

    send_id(msgid, "clipify-text", {
		"vectors": embedded
	})


##########################################################################

for line in sys.stdin:
    obj = json.loads(line)
    match obj["event"]:
        case "start":
            initialise(
                model_clip=obj["data"]["model_clip"],
                device=obj["data"]["device"]
            )
        case "clipify-image":
            clipify_image(msgid(obj), obj["data"]["filepaths"])
        case "clipify-text":
            clipify_text(msgid(obj), obj["data"]["text"])
