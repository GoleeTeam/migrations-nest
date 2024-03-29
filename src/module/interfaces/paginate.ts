export const paginate = async (
    param: { count: number; limit: number; initialSkip?: number },
    func: (skip: number, limit: number) => Promise<void>,
) => {
    for (let skip = param.initialSkip || 0; skip < param.count; skip += param.limit) {
        await func(skip, param.limit);
    }
};
