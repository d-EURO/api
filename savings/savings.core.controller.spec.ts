import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { zeroAddress } from 'viem';
import { SavingsCoreController } from './savings.core.controller';
import { SavingsCoreService } from './savings.core.service';

jest.mock('./savings.core.service', () => ({ SavingsCoreService: class {} }));

const MIXED_CASE = '0x75bEb37A3c86eE4C38931E2A9319e078da612979';
const LOWER = '0x75beb37a3c86ee4c38931e2a9319e078da612979';

describe('SavingsCoreController GET /savings/core/user/:address', () => {
	let app: INestApplication;
	const getUserTables = jest.fn();

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({
			controllers: [SavingsCoreController],
			providers: [{ provide: SavingsCoreService, useValue: { getUserTables } }],
		}).compile();
		app = moduleRef.createNestApplication({ logger: false });
		await app.listen(0, '127.0.0.1');
	});

	afterAll(() => app.close());

	beforeEach(() => {
		getUserTables.mockReset();
		getUserTables.mockResolvedValue({ save: [], interest: [], withdraw: [], vaultSave: [], vaultWithdraw: [] });
	});

	it.each(['x"', '0x1234" OR "1"="1', '0x1234', 'foo'])('returns 400 for %p', async (address) => {
		await request(app.getHttpServer())
			.get(`/savings/core/user/${encodeURIComponent(address)}`)
			.expect(400);
		expect(getUserTables).not.toHaveBeenCalled();
	});

	it('accepts a mixed-case address and passes it on lowercased', async () => {
		await request(app.getHttpServer()).get(`/savings/core/user/${MIXED_CASE}`).expect(200);
		expect(getUserTables).toHaveBeenCalledWith(LOWER);
	});

	it.each(['0', 'all', 'zero', 'zeroAddress', zeroAddress])('maps keyword %p to zeroAddress', async (keyword) => {
		await request(app.getHttpServer()).get(`/savings/core/user/${keyword}`).expect(200);
		expect(getUserTables).toHaveBeenCalledWith(zeroAddress);
	});
});
