import { Order, OrderItem } from '@prisma/client';
import { UserResponse } from './userTypes';

export interface CreateOrderRequest {
    userId: number;
    items: {
        productId: number,
        quantity: number,
    }[];
}

export type OrderResponse = Omit<Order, 'userId'> & {
    user: UserResponse,
    items: OrderItem[],
};
