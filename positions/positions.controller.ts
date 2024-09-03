import { Controller, Get } from '@nestjs/common';
import { PositionsService } from './positions.service';
import {
	ApiMintingUpdateListing,
	ApiMintingUpdateMapping,
	ApiPositionsListing,
	ApiPositionsMapping,
	ApiPositionsOwners,
} from './positions.types';
import { ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Positions Controller')
@Controller('positions')
export class PositionsController {
	constructor(private readonly positionsService: PositionsService) {}

	@Get('list')
	@ApiResponse({
		description: 'Returns a list of all positions',
	})
	getList(): ApiPositionsListing {
		return this.positionsService.getPositionsList();
	}

	@Get('mapping')
	@ApiResponse({
		description: 'Returns a mapping of all positions',
	})
	getMapping(): ApiPositionsMapping {
		return this.positionsService.getPositionsMapping();
	}

	@Get('open')
	@ApiResponse({
		description: 'Returns a filtered mapping of open positions',
	})
	getOpen(): ApiPositionsMapping {
		return this.positionsService.getPositionsOpen();
	}

	@Get('requests')
	@ApiResponse({
		description: 'Returns a filtered mapping of requested positions (default: less then 5 days old)',
	})
	getRequestPositions(): ApiPositionsMapping {
		return this.positionsService.getPositionsRequests();
	}

	@Get('owners')
	@ApiResponse({
		description: 'Returns a mapping of positions mapped by owner',
	})
	getOwners(): ApiPositionsOwners {
		return this.positionsService.getPositionsOwners();
	}

	@Get('mintingupdates/list')
	@ApiResponse({
		description: 'Returns a list of all mintingupdates',
	})
	getMintingList(): ApiMintingUpdateListing {
		return this.positionsService.getMintingUpdatesList();
	}

	@Get('mintingupdates/mapping')
	@ApiResponse({
		description: 'Returns a mapping of all mintingupdates',
	})
	geMintingtMapping(): ApiMintingUpdateMapping {
		return this.positionsService.getMintingUpdatesMapping();
	}
}
