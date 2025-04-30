// CORE IMPORTS
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

// SERVICE IMPORTS
import { ApiService } from 'api.service';
import { ChallengesService } from 'challenges/challenges.service';
import { EcosystemCollateralService } from 'ecosystem/ecosystem.collateral.service';
import { EcosystemDepsService } from 'ecosystem/ecosystem.deps.service';
import { EcosystemMinterService } from 'ecosystem/ecosystem.minter.service';
import { EcosystemStablecoinService } from 'ecosystem/ecosystem.stablecoin.service';
import { PositionsService } from 'positions/positions.service';
import { PricesService } from 'prices/prices.service';
import { TelegramService } from 'telegram/telegram.service';

// CONTROLLER IMPORTS
import { AnalyticsController } from 'analytics/analytics.controller';
import { AnalyticsService } from 'analytics/analytics.service';
import { ChallengesController } from 'challenges/challenges.controller';
import { EcosystemCollateralController } from 'ecosystem/ecosystem.collateral.controller';
import { EcosystemDepsController } from 'ecosystem/ecosystem.deps.controller';
import { EcosystemMinterController } from 'ecosystem/ecosystem.minter.controller';
import { EcosystemStablecoinController } from 'ecosystem/ecosystem.stablecoin.controller';
import { FrontendCodeService } from 'frontendcode/frontendcode.service';
import { PositionsController } from 'positions/positions.controller';
import { PricesController } from 'prices/prices.controller';
import { SavingsCoreController } from 'savings/savings.core.controller';
import { SavingsCoreService } from 'savings/savings.core.service';
import { SavingsLeadrateController } from 'savings/savings.leadrate.controller';
import { SavingsLeadrateService } from 'savings/savings.leadrate.service';
import { StorageService } from 'storage/storage.service';
import { TwitterService } from 'twitter/twitter.service';

// APP MODULE
@Module({
	imports: [ConfigModule.forRoot(), ScheduleModule.forRoot()],
	controllers: [
		PositionsController,
		EcosystemMinterController,
		EcosystemCollateralController,
		EcosystemDepsController,
		EcosystemStablecoinController,
		SavingsLeadrateController,
		SavingsCoreController,
		PricesController,
		ChallengesController,
		AnalyticsController,
	],
	providers: [
		StorageService,
		PositionsService,
		EcosystemMinterService,
		EcosystemCollateralService,
		EcosystemDepsService,
		EcosystemStablecoinService,
		SavingsLeadrateService,
		SavingsCoreService,
		PricesService,
		ChallengesService,
		ApiService,
		AnalyticsService,
		FrontendCodeService,
		TelegramService,
		TwitterService,
	],
})
export class AppModule {}
