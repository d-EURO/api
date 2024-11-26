import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './api.module';
// import * as dotenv from 'dotenv';
// dotenv.config();

async function bootstrap() {
	const api = await NestFactory.create(AppModule, { cors: true });

	const config = new DocumentBuilder()
		.setTitle(process.env.npm_package_name)
		.setDescription('The API description')
		.setVersion(process.env.npm_package_version)
		.build();
	const document = SwaggerModule.createDocument(api, config);
	SwaggerModule.setup('/', api, document, {
		swaggerOptions: {
			persistAuthorization: true,
		},
	});

	await api.listen(process.env.PORT || 3000);
}
bootstrap();
