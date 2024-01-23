import { NFTStorage, File } from "nft.storage";
import { kebabCase } from "lodash";

export class NFTStorageClient {
    client: NFTStorage;

    constructor({ token }: { token: string }) {
        this.client = new NFTStorage({ token });
    }

    async store({
        name,
        description,
        imageFile,
        additionalMetadata,
    }: {
        name: string;
        description?: string | null;
        imageFile?: File | null;
        additionalMetadata?: any;
    }): Promise<string> {
        const slugifiedName = kebabCase(name);

        // get data from file
        const metadata = await (this.client as NFTStorage).store({
            name: name,
            ...(description && { description }),
            // TODO: change extension based on type
            ...(imageFile && {
                image: new File(
                    [new Blob([imageFile], { type: imageFile.type })],
                    `${slugifiedName}.jpg`,
                    {
                        type: imageFile.type,
                    },
                ),
            }),
            ...(additionalMetadata || {}),
        });
        return metadata.url;
    }
}
