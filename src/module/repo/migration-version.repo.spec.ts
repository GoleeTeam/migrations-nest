import { Test, TestingModule } from '@nestjs/testing';
import { Collection, MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MigrationVersion, MigrationVersionRepo } from './migration-version.repo';

describe('MigrationVersionRepo', () => {
    let module: TestingModule;
    let mongoServer: MongoMemoryServer;
    let mongoClient: MongoClient;
    let repo: MigrationVersionRepo;
    let collection: Collection<MigrationVersion>;

    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        const uri = mongoServer.getUri();
        mongoClient = new MongoClient(uri);
        await mongoClient.connect();

        module = await Test.createTestingModule({
            providers: [{ provide: MigrationVersionRepo, useFactory: () => new MigrationVersionRepo(mongoClient) }],
        }).compile();

        collection = mongoClient.db().collection<MigrationVersion>('migrations_version');
        repo = module.get<MigrationVersionRepo>(MigrationVersionRepo);
    });

    afterAll(async () => {
        await mongoClient.close();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        await collection.deleteMany({});
    });

    it('should have not document on creation', async () => {
        expect(repo).toBeDefined();
        expect(await collection.findOne()).toBeNull();
    });

    it('should create a document on init with version 0 and lock false and other defaults', async () => {
        await repo.init();
        expect(await collection.findOne()).toMatchObject({
            version: 0,
            lock: false,
            last_run_completed: false,
            last_run_error: '',
        });
    });

    it('should not change the document if already exists or create a new one', async () => {
        const existingVersion = {
            version: 1,
            lock: true,
            last_run_completed: true,
            last_run_error: 'error',
        };
        await collection.insertOne(existingVersion);

        await repo.init();

        expect(await collection.find().toArray()).toEqual([existingVersion]);
    });
});
