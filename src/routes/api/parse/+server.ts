import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = (async ({ request, setHeaders }) => {
    try {
        const apiServerBaseUrl = env.API_SERVER;

        if (!apiServerBaseUrl) {
            throw new Error('API_SERVER environment variable is not set');
        }

        const apiReqUrl = new URL('/api/parse', apiServerBaseUrl);
        const apiResponse = await fetch(apiReqUrl, {
            method: 'POST',
            headers: {
                'Content-Type': request.headers.get('Content-Type') || 'application/json',
            },
            body: await request.text()
        });

        if (!apiResponse.ok) {
            throw new Error(`API responded with status: ${apiResponse.status}`);
        }

        // Set headers for SSE
        setHeaders({
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        // Create a readable stream from the API response
        const reader = apiResponse.body?.getReader();
        const stream = new ReadableStream({
            async start(controller) {
                while (true) {
                    const { done, value } = await reader!.read();
                    if (done) break;
                    controller.enqueue(value);
                }
                controller.close();
            }
        });

        return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
    } catch (error) {
        console.error('Error in parse request:', error);
        throw error(500, 'An error occurred while processing your request');
    }
}) satisfies RequestHandler;
