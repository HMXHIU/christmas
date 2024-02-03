import { error } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";

export async function POST({ request, params, url }) {
    const body = await request.json();
    console.log(JSON.stringify(body, null, 2));
    console.log(JSON.stringify(params, null, 2));
    return json(body, { status: 201 });
}
