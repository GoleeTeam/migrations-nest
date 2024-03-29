# Migrations

Below an example of how to configure two migrations scripts (order matters) and their dependencies.

```TypeScript
MigrationsModule.forRoot({
    mongoDbConnectionName: 'monogoose_connection_name', // If not specified will use the default connection
	scripts: [
		{
			provide: 'MigrationExample1',
			useFactory: (repo: Repo) => {
				return new MigrationExample1(repo);
			},
			inject: [Repo],
		},
		{
			provide: 'MigrationExample2',
			useFactory: (providerx: ProviderX) => {
				return new MigrateDeletedGeorgianClubs(providerx);
			},
			inject: [ProviderX],
		},
	],
	imports: [
		XModule,
		MongooseModule.forFeature([{ name: 'XModel', schema: XModel, collection: 'xmodels' }]),
	],
})
```