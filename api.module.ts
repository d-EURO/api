// CORE IMPORTS
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';

// SERVICE IMPORTS
import { ApiService } from 'api.service';
import { EcosystemCollateralService } from 'ecosystem/ecosystem.collateral.service';
import { EcosystemFpsService } from 'ecosystem/ecosystem.fps.service';
import { EcosystemFrankencoinService } from 'ecosystem/ecosystem.frankencoin.service';
import { EcosystemMinterService } from 'ecosystem/ecosystem.minter.service';
import { PositionsService } from 'positions/positions.service';
import { PricesService } from 'prices/prices.service';
import { ChallengesService } from 'challenges/challenges.service';
import { TelegramService } from 'telegram/telegram.service';

// CONTROLLER IMPORTS
import { EcosystemMinterController } from 'ecosystem/ecosystem.minter.controller';
import { EcosystemCollateralController } from 'ecosystem/ecosystem.collateral.controller';
import { EcosystemFpsController } from 'ecosystem/ecosystem.fps.controller';
import { EcosystemFrankencoinController } from 'ecosystem/ecosystem.frankencoin.controller';
import { PositionsController } from 'positions/positions.controller';
import { PricesController } from 'prices/prices.controller';
import { ChallengesController } from 'challenges/challenges.controller';
import { Storj } from 'storj/storj.s3.service';
import { AnalyticsController } from 'analytics/analytics.controller';
import { AnalyticsService } from 'analytics/analytics.service';
import { SavingsLeadrateController } from 'savings/savings.leadrate.controller';
import { SavingsLeadrateService } from 'savings/savings.leadrate.service';
import { SavingsCoreController } from 'savings/savings.core.controller';
import { SavingsCoreService } from 'savings/savings.core.service';

// APP MODULE
@Module({
	imports: [ConfigModule.forRoot(), ScheduleModule.forRoot()],
	controllers: [
		PositionsController,
		EcosystemMinterController,
		EcosystemCollateralController,
		EcosystemFpsController,
		EcosystemFrankencoinController,
		SavingsLeadrateController,
		SavingsCoreController,
		PricesController,
		ChallengesController,
		AnalyticsController,
	],
	providers: [
		Storj,
		PositionsService,
		EcosystemMinterService,
		EcosystemCollateralService,
		EcosystemFpsService,
		EcosystemFrankencoinService,
		SavingsLeadrateService,
		SavingsCoreService,
		PricesService,
		ChallengesService,
		TelegramService,
		ApiService,
		AnalyticsService,
	],
})
export class AppModule {}
