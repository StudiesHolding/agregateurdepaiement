import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { getToken } from "next-auth/jwt";

/**
 * Relais sécurisé — tableau de bord du PSP (ADR-0018, D5)
 * Les appels du navigateur vers /api/psp/admin/* sont relayés au backend avec le jeton de session de la personne
 * connectée (lu dans le cookie chiffré, côté serveur). Sans session : 401. Aucune clé de repli, aucun autre chemin.
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";
const SAFE_PATH = /^admin\/[A-Za-z0-9/_.-]*$/;

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
    // 1. Session obligatoire et chemin limité à l'API d'administration
    const session = await getToken({ req, secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET, secureCookie: process.env.NODE_ENV === "production" });
    const backendToken = (session as { backendToken?: string } | null)?.backendToken;
    if (!backendToken) return NextResponse.json({ status: "error", message: "Session requise." }, { status: 401 });
    const path = pathSegments.join("/");
    if (!SAFE_PATH.test(path) || path.includes("..")) return NextResponse.json({ status: "error", message: "Chemin refusé." }, { status: 400 });
    const searchParams = req.nextUrl.search;
    const targetUrl = `${BACKEND_URL}/api/${path}${searchParams}`;

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

    // 3. Relais avec le jeton de session de la personne connectée
    try {
        const axiosConfig: any = {
            method,
            url: targetUrl,
            headers: {
                Authorization: `Bearer ${backendToken}`,
            },
            validateStatus: () => true,
        };

        // Only include data if it exists and it's a mutation method
        if (body && Object.keys(body).length > 0 && ["POST", "PUT", "PATCH"].includes(method)) {
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
