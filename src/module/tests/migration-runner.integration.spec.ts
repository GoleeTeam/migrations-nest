import { Collection, MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MigrationsRunner } from '../migration-runner.service';
import { MigrationsScriptsProvider } from '../migrations-scripts.provider';
import { MigrationVersionRepo } from '../repo/migration-version.repo';

describe('MigrationsRunner integration', () => {
    let mongoServer: MongoMemoryServer;
    let mongoClient: MongoClient;

    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        mongoClient = new MongoClient(mongoServer.getUri());
        await mongoClient.connect();
    });

    afterAll(async () => {
        await mongoClient.close();
        await mongoServer.stop();
    });

    // both runners reach their first write before either of them performs it, so a runner that
    // decides what to run by reading the lock beforehand always sees it free
    function holdFirstWriteUntilBothRunnersArrive(repos: MigrationVersionRepo[]) {
        let arrived = 0;
        let releaseAll: () => void;
        const allArrived = new Promise<void>((resolve) => {
            releaseAll = resolve;
        });
        for (const repo of repos) {
            const collection = (repo as unknown as { collection: Collection }).collection;
            const updateOne = collection.updateOne.bind(collection);
            let writes = 0;
            jest.spyOn(collection, 'updateOne').mockImplementation(async (...args) => {
                if ((writes += 1) === 1) {
                    if ((arrived += 1) === repos.length) releaseAll();
                    await allArrived;
                }
                return updateOne(...args);
            });
        }
    }

    it('runs a migration once when two runners start concurrently', async () => {
        const firstRepo = new MigrationVersionRepo(mongoClient, 'migrations_version');
        const secondRepo = new MigrationVersionRepo(mongoClient, 'migrations_version');
        await firstRepo.init();

        const run = jest.fn();
        const scripts = new MigrationsScriptsProvider([{ version: 1, run }]);
        holdFirstWriteUntilBothRunnersArrive([firstRepo, secondRepo]);

        await Promise.all([
            new MigrationsRunner(firstRepo, scripts).runMigrations(),
            new MigrationsRunner(secondRepo, scripts).runMigrations(),
        ]);

        expect(run).toHaveBeenCalledTimes(1);
    });
});
