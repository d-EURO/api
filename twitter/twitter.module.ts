import { Module } from '@nestjs/common';
import { TwitterService } from './twitter.service';

@Module({
	imports: [],
	controllers: [],
	providers: [TwitterService],
	exports: [],
})
export class TwitterModule {}
