import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PositionsController } from './positions.controller';
import { PositionsService } from './positions.service';

jest.mock('./positions.service', () => ({ PositionsService: class {} }));

const COLLATERAL = '0x75bEb37A3c86eE4C38931E2A9319e078da612979';
const HUB = '0x0000000000000000000000000000000000000001';

describe('PositionsController GET /positions/best-cloneable', () => {
	let app: INestApplication;
	const getBestCloneableParent = jest.fn();

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({
			controllers: [PositionsController],
			providers: [{ provide: PositionsService, useValue: { getBestCloneableParent } }],
		}).compile();
		app = moduleRef.createNestApplication({ logger: false });
		await app.listen(0, '127.0.0.1');
	});

	afterAll(() => app.close());

	beforeEach(() => {
		getBestCloneableParent.mockReset();
		getBestCloneableParent.mockReturnValue({ position: null });
	});

	it('passes lowercased addresses to the service', async () => {
		await request(app.getHttpServer())
			.get('/positions/best-cloneable')
			.query({ collateral: COLLATERAL, mintingHubAddress: HUB })
			.expect(200);
		expect(getBestCloneableParent).toHaveBeenCalledWith(COLLATERAL.toLowerCase(), HUB);
	});

	it('treats mintingHubAddress as optional', async () => {
		await request(app.getHttpServer()).get('/positions/best-cloneable').query({ collateral: COLLATERAL }).expect(200);
		expect(getBestCloneableParent).toHaveBeenCalledWith(COLLATERAL.toLowerCase(), undefined);
	});

	it.each([
		['collateral as array', `collateral[]=${COLLATERAL}&collateral[]=${COLLATERAL}`],
		['collateral repeated', `collateral=${COLLATERAL}&collateral=${COLLATERAL}`],
		['mintingHubAddress as array', `collateral=${COLLATERAL}&mintingHubAddress[]=${HUB}`],
		['invalid collateral', 'collateral=abc'],
		['invalid mintingHubAddress', `collateral=${COLLATERAL}&mintingHubAddress=abc`],
		['missing collateral', ''],
	])('returns 400 for %s', async (_, query) => {
		await request(app.getHttpServer()).get(`/positions/best-cloneable?${query}`).expect(400);
		expect(getBestCloneableParent).not.toHaveBeenCalled();
	});
});
