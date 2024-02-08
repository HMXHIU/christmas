export function getCookiesFromResponse(response: Response): string {
    let cookies: string[] = [];

    response.headers.forEach((value, name) => {
        console.log(name, value);
        if (name.toLowerCase() === "set-cookie") {
            cookies.push(...value.split(",")); // multiple set-cookie headers
        }
    });

    return cookies.join("; ");
}
