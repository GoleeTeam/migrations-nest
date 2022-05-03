import { Test, TestingModule } from "@nestjs/testing";
import { MigrationsScripts } from "./migrations-scripts.provider";
import { IMigrationScript } from "./interfaces/migration-script.interface";

describe("MigrationsScripts", function () {
  let service: MigrationsScripts;

  const migration1RunMock = jest.fn();
  const migration2RunMock = jest.fn();

  class MigrationScript1Fixture implements IMigrationScript {
    run = migration1RunMock;
  }
  class MigrationScript2Fixture implements IMigrationScript {
    run = migration2RunMock;
  }

  const migrationScriptsFixture = [
    new MigrationScript1Fixture(),
    new MigrationScript2Fixture(),
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: MigrationsScripts,
          useFactory: () => {
            return new MigrationsScripts(migrationScriptsFixture);
          },
        },
      ],
    }).compile();

    service = module.get<MigrationsScripts>(MigrationsScripts);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getAvailableMigrations", function () {
    it("should return a map of the same length of the migrations scripts passed in constructor", function () {
      expect(service.getAvailableMigrationsVersions().length).toEqual(
        migrationScriptsFixture.length
      );
    });
  });
  describe("runMigration", function () {
    it("should run migration 1 and not the 2", async function () {
      await service.runMigration(1);
      expect(migration1RunMock).toHaveBeenCalledTimes(1);
      expect(migration2RunMock).not.toHaveBeenCalled();
    });
    it("should run migration 2 and not the 1", async function () {
      await service.runMigration(2);
      expect(migration2RunMock).toHaveBeenCalledTimes(1);
      expect(migration1RunMock).not.toHaveBeenCalled();
    });
  });
});
