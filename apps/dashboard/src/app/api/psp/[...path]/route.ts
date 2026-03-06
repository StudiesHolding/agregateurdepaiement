import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

/**
 * Secure Proxy Route Handler — Studies PSP Dashboard
 * This handler intercepts client-side calls to /api/psp/* and forwards them
 * to the backend while injecting the ADMIN_API_KEY from environment variables.
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
    return handleProxy(req, params.path);
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
    return handleProxy(req, params.path);
}

export async function PUT(req: NextRequest, { params }: { params: { path: string[] } }) {
    return handleProxy(req, params.path);
}

export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
    return handleProxy(req, params.path);
}

async function handleProxy(req: NextRequest, pathSegments: string[]) {
    // 1. Construct the target URL
    const path = pathSegments.join("/");
    const searchParams = req.nextUrl.search;
    const targetUrl = `${BACKEND_URL}/api/${path}${searchParams}`;

    console.log(`[Dashboard Proxy] ${req.method} ${req.nextUrl.pathname} -> ${targetUrl}`);

    // 2. Extract method and body
    const method = req.method;
    let body = null;
    if (["POST", "PUT", "PATCH"].includes(method)) {
        try {
            body = await req.json();
        } catch (e) {
            // No body or invalid JSON
        }
    }

    // 3. Forward the request to the backend with the API Key
    try {
        const axiosConfig: any = {
            method,
            url: targetUrl,
            headers: {
                "x-api-key": ADMIN_API_KEY,
            },
            validateStatus: () => true,
        };

        if (body) {
            axiosConfig.data = body;
            axiosConfig.headers["Content-Type"] = "application/json";
        }

        const response = await axios(axiosConfig);

        // 4. Return the backend response to the client
        return NextResponse.json(response.data, { status: response.status });
    } catch (error: any) {
        console.error(`[Dashboard Proxy] Error forwarding to ${targetUrl}:`, error.message);
        return NextResponse.json(
            { status: "error", message: "Failed to connect to backend", details: error.message },
            { status: 502 }
        );
    }
}
