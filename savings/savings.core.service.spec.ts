import { zeroAddress } from 'viem';
import { PONDER_CLIENT } from 'api.apollo.config';
import { SavingsCoreService } from './savings.core.service';

jest.mock('api.apollo.config', () => ({ PONDER_CLIENT: { query: jest.fn() } }));
jest.mock('api.config', () => ({}));
jest.mock('ecosystem/ecosystem.stablecoin.service', () => ({ EcosystemStablecoinService: class {} }));
jest.mock('./savings.leadrate.service', () => ({ SavingsLeadrateService: class {} }));

const USER = '0x75beb37a3c86ee4c38931e2a9319e078da612979';

describe('SavingsCoreService.getUserTables', () => {
	const query = PONDER_CLIENT.query as jest.Mock;
	const service = new SavingsCoreService(undefined, undefined);

	beforeEach(() => {
		query.mockReset();
		query.mockResolvedValue({ data: {} });
	});

	const variablesOf = () => query.mock.calls.map(([options]) => options.variables);

	it('filters by account and owner through GraphQL variables', async () => {
		await service.getUserTables(USER);

		expect(variablesOf()).toEqual([
			{ limit: 15, where: { account: USER } },
			{ limit: 15, where: { account: USER } },
			{ limit: 15, where: { account: USER } },
			{ limit: 15, where: { owner: USER } },
			{ limit: 15, where: { owner: USER } },
		]);
		for (const [options] of query.mock.calls) {
			expect(options.query.loc.source.body).not.toContain(USER);
		}
	});

	it('omits the filter for zeroAddress', async () => {
		await service.getUserTables(zeroAddress);

		expect(variablesOf()).toEqual(Array(5).fill({ limit: 15 }));
	});
});
