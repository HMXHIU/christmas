import { NFTStorage, File } from "nft.storage";
import { kebabCase } from "lodash";

export default class NFTStorageClient {
    token: string;
    client: NFTStorage;

    constructor({ token }: { token: string }) {
        this.token = token;
        this.client = new NFTStorage({ token: token });
    }

    async store({
        name,
        description,
        imageFile,
    }: {
        name: string;
        description: string;
        imageFile: File;
    }): Promise<string> {
        const slugifiedName = kebabCase(name);

        // get data from file
        const blob = new Blob([imageFile], { type: imageFile.type });

        const metadata = await this.client.store({
            name: name,
            description: description,
            // TODO: change extension based on type
            image: new File([blob], `${slugifiedName}.jpg`, {
                type: imageFile.type,
            }),
        });

        return metadata.url;
    }
}
