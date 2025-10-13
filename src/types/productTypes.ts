import { Product } from '@prisma/client';

export interface CreateProductRequest {
    name: string;
    description?: string;
    price: number;
    stock: number;
}

export interface UpdateProductRequest {
    name?: string;
    description?: string;
    price?: number;
    stock?: number;
}

export type ProductResponse = Product;
