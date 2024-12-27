import os
# import io

from loguru import logger

import torch
import torchvision
# import simplejpeg

from torchvision.transforms import Compose, Resize, CenterCrop
#, ToTensor, Normalize
from torchvision.transforms import InterpolationMode

# Imported from https://github.com/sbrl/research-smflooding, since I'm the author thereof --@sbrl 2024-12-17

class CLIPImageDataset(torch.utils.data.Dataset):
    def __init__(
        self, filepaths: list[str], device: str | torch.device, image_size: int
    ) -> None:
        super(CLIPImageDataset).__init__()
        logger.info(f"IMAGE SIZE {image_size}")
        self.device = device

        # self.preprocess = clip_preprocess
        self.image_size = image_size
        # From https://github.com/openai/CLIP/blob/40f5484c1c74edd83cb9cf687c6ab92b28d8b656/clip/clip.py#L78 with the conversion to RGB removed so we can use simplejpeg instead
        self.preprocess = Compose(
            [
                Resize(image_size, interpolation=InterpolationMode.BICUBIC),
                CenterCrop(image_size),
                # ToTensor(), # Not needed, as we're feeding tensors in rather than PIL images
                # Normalize( # Normalised below. I don't remember what this does....? Perhaps its from the CLIP source code or something?
                # 	(0.48145466, 0.4578275, 0.40821073),
                # 	(0.26862954, 0.26130258, 0.27577711),
                # ),
            ]
        )

        self.files = filepaths
        self.length = len(self.files)
        logger.info(f"Loaded {self.length} image filenames")

    def __len__(self) -> int:
        return self.length

    def __getitem__(self, image_id: int) -> torch.Tensor:
        filename = self.files[
            image_id
        ]  # NOTE: We don't png → jpeg here 'cause we're not operating on a clean dataset here...!
        ext = os.path.splitext(filename)[1].lower()
        image = None
        try:
            match ext:
                case "hiec":
                    torchvision.io.decode_heic(filename, mode="RGB")
                case "avif":
                    torchvision.io.decode_avif(filename, mode="RGB")
                # TODO add OpenRaster, JXL, etc support here (will prob hafta use lib → torch.as_tensor() etc)
                case _:
                    image = torchvision.io.decode_image(filename, mode="RGB")

            dtype = image.dtype
            image = image.type(torch.float32)
            match dtype:
                case torch.uint16:
                    image = image / 65535
                    # image = torchvision.transforms.v2.functional.to_dtype(image, dtype=torch.uint8, scale=True)
                case torch.uint8:
                    image = image / 255

                # Let's just hope that everything is okay

            # with io.open(filename, "rb") as handle:
            # image = simplejpeg.decode_jpeg(
            # 	handle.read(), fastdct=True, fastupsample=True
            # )
        except Exception as error:
            logger.warning(f"Caught error: {error}")
            return None

        # Shape from torchvision.decode_image is [ channel, width, height ]
        print("DEBUG:__getitem__ BEFORE_PERMUTE image.shape", image.shape)
        # image = torch.as_tensor(image, dtype=torch.float32).permute(2, 0, 1)
        image = image.permute(0, 2, 1)
        # Shape is now [ channel, height, width ]
        print("DEBUG:__getitem__ AFTER_PERMUTE image.shape", image.shape)
        # return self.preprocess(image).to(device=self.device)
        return self.preprocess(image).to(device=self.device)
        # return self.preprocess(Image.open(self.files[image_id])).to(device=self.device)

    # If one knows the batch size and the number of batches processed, one can determine the index of the filename in question
    def get_filename(self, image_id) -> str:
        return self.files[image_id]
