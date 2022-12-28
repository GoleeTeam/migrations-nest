import { paginate } from './paginate';

describe('cronjob paginate function', () => {
	const func = jest.fn();

	afterEach(async () => {
		jest.resetAllMocks();
	});

	it('should paginate correctly 0 count, limit 10', async () => {
		await paginate({ count: 0, limit: 10 }, func);

		expect(func).toBeCalledTimes(0);
	});

	it('should paginate correctly 5 count, limit 10', async () => {
		await paginate({ count: 5, limit: 10 }, func);

		expect(func).toBeCalledTimes(1);
	});

	it('should paginate correctly 10 count, limit 10', async () => {
		await paginate({ count: 10, limit: 10 }, func);

		expect(func).toBeCalledTimes(1);
	});

	it('should paginate correctly 42 count, limit 10', async () => {
		await paginate({ count: 42, limit: 10 }, func);

		expect(func).toBeCalledTimes(5);
		expect(func.mock.calls[0]).toEqual([0, 10]);
		expect(func.mock.calls[1]).toEqual([10, 10]);
		expect(func.mock.calls[2]).toEqual([20, 10]);
		expect(func.mock.calls[3]).toEqual([30, 10]);
		expect(func.mock.calls[4]).toEqual([40, 10]);
	});

	it('should paginate correctly 42 count, limit 100', async () => {
		await paginate({ count: 42, limit: 100 }, func);

		expect(func).toBeCalledTimes(1);
	});
});
