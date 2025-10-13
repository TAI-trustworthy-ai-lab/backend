import { Vote } from '@prisma/client';

export interface CreateVoteRequest {
    userId: number;
    reward: string;
}

export type VoteResponse = Vote;
