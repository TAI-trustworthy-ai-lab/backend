import { Request } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { ParsedQs } from 'qs';

export interface TypedRequestBody<T> extends Request {
    body: T;
}

export interface TypedRequestParams<T extends ParamsDictionary> extends Request {
    params: T;
}

export interface TypedRequestQuery<T extends ParsedQs> extends Request {
    query: T;
}
