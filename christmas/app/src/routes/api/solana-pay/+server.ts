import { parseURL } from "@solana/pay";
import { json } from "@sveltejs/kit";

/** @type {import('@sveltejs/kit').RequestHandler} */
export const GET = (event: any) => {
    let label = "Community";
    let icon =
        "https://en.wikipedia.org/wiki/Community_%28TV_series%29#/media/File:Community_title.jpg";

    return json({
        label,
        icon,
    });
};

/** @type {import('@sveltejs/kit').RequestHandler} */
export const POST = async (event: any) => {
    // Get request body and url parameters
    let body = await event.request.json();
    let signer_ip = event.request.headers.get("x-forwarded-for");

    const solanaPayParameters = parseURL(event.url);

    return json({
        transaction: "base64Transaction", // return serialized partially signed transaction
        message: solanaPayParameters.message,
    });
};
