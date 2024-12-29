# imgscout

> AI-assisted vector image search with metadata filtering

imgscout is an early work-in-progress search engine for your photos, videos, PDFs, and other related graphical files.

It regularly crawls and indexes the images(/etc) in list of directories, and provides a web interface search engine to search and filter your images.

**Current status:** 🟥 ⚠️ Work in progress! It isn't finished yet! Don't expect it to work! ⚠️ 🟥

## System requirements
- [Node.js](https://nodejs.org/)
- [Imagemagick](https://imagemagick.org/) - either v6 or v7+
	- We look for either `magick` or `convert` in `PATH` in that order
- Exiftool is bundled with imgscout!
- Python
	- [Loguru](https://loguru.readthedocs.io/) - TODO remove this dependency
	- [CLIP](https://github.com/openai/CLIP)
	- [PyTorch](https://pytorch.org/) + `torchvision`


## Getting started
TODO fill out the rest of this README.



## Architecture notes

### Data storage
imgscout has 3 indexes:

1. Metadata index
	- Stores file metadata, extracted by bundled [exiftool](https://www.npmjs.com/package/exiftool-vendored)
	- Backed by [`njodb`](https://www.npmjs.com/package/njodb)
2. Vector index
	- Stores image/file/etc embeddings from AI
	- Search algorithm is [`hnsw`](https://www.npmjs.com/package/hnsw)
	- Data storage backed by [JSONL](https://jsonlines.org/) (TODO add BSON support + support for more compression algorithms)
	- TODO upgrade to something more scalable ref memory usage

### Artificial intelligence statement
imgscout strives to use local, open, and ethical artificial intelligence models where possible. AI is rather complicated to implement though, so this is a goal to continuously strive for.

At the moment, imgscout is backed by [OpenAI's CLIP](https://github.com/openai/CLIP).

A future goal is to reduce resource and energy usage as much as possible while maintaining performance. For example, this could mean quantising CLIP models to `int8` where possible.

## Philosophy
Note that some of these are a work-in-progress.

- imgscout will not touch any of the files in provided directories, and treats them as read-only
- AI will be implemented ethically and transparently
- A friendly and welcoming environment for both users and contributors is desirable
- Pure JS libraries are always preferred to enable portability and reduce compilation issues
- The number of Python dependencies will be minimised as much as possible
- All dependencies and setup instructions should be clearly detailed and defined
- "Documentation, not code, defines what a program does" - great docs are v important
- *Please* put imgscout behind a reverse proxy....!


## Contributing
Contributions are very welcome! At the moment in this early stage the application is not finished yet, so don't download this expecting it to work!

If you'd like to hack on it, feel free. If you'd like to contribute back/etc, please get in touch so we can coordinate efforts.

Opening issues are very welcome, but as mentioned above it's not finished yet, so please refrain from opening an issue to say it doesn't work.

## License
imgscout is released under the GNU Affero General Public License v3. The full license text is included in the LICENSE file in this repository. [Tldr legal have a great summary](https://www.tldrlegal.com/license/gnu-affero-general-public-license-v3-agpl-3-0) of the license if you're interested.