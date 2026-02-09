import { NextResponse } from 'next/server';

export interface ApiSuccessEnvelope<T> {
    success: true;
    data: T;
    error: null;
    code: null;
}

export interface ApiErrorEnvelope {
    success: false;
    data: null;
    error: string;
    code: string;
    details?: unknown;
}

export type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

export function apiSuccess<T>(data: T, status = 200): NextResponse<ApiSuccessEnvelope<T>> {
    return NextResponse.json(
        {
            success: true,
            data,
            error: null,
            code: null,
        },
        { status }
    );
}

export function apiError(
    code: string,
    error: string,
    status = 400,
    details?: unknown
): NextResponse<ApiErrorEnvelope> {
    return NextResponse.json(
        {
            success: false,
            data: null,
            error,
            code,
            ...(details !== undefined ? { details } : {}),
        },
        { status }
    );
}
