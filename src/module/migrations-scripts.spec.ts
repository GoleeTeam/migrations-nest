import { Test, TestingModule } from "@nestjs/testing";
import { MigrationsScripts } from "./migrations-scripts.provider";
import { IMigrationScript } from "./interfaces/migration-script.interface";

describe("MigrationsScripts", function () {
  let service: MigrationsScripts;

  const migration1RunMock = jest.fn();
  const migration2RunMock = jest.fn();
  const migration4RunMock = jest.fn();

  class MigrationScript1Fixture implements IMigrationScript {
    version = 1;
    run = migration1RunMock;
  }
  class MigrationScript2Fixture implements IMigrationScript {
    version = 2;
    run = migration2RunMock;
  }
  class MigrationScript4Fixture implements IMigrationScript {
    version = 4;
    run = migration4RunMock;
  }

  const migrationScriptsFixture = [
    new MigrationScript4Fixture(),
    new MigrationScript2Fixture(),
    new MigrationScript1Fixture(),
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
    jest.resetAllMocks();
  });

  describe("getAvailableMigrations", function () {
    it("should return an array of the same length of the migrations scripts passed in constructor", function () {
      expect(service.getAvailableMigrationsVersions().length).toEqual(
        migrationScriptsFixture.length
      );
    });
    it("should return a sorted array that maps script versions value", function () {
      expect(service.getAvailableMigrationsVersions()).toEqual([1, 2, 4]);
    });
  });

  describe("runMigration", function () {
    it("should run migration 1 and not the others", async function () {
      await service.runMigration(1);
      expect(migration1RunMock).toHaveBeenCalledTimes(1);
      expect(migration2RunMock).not.toHaveBeenCalled();
      expect(migration4RunMock).not.toHaveBeenCalled();
    });
    it("should run migration 2 and not the others", async function () {
      await service.runMigration(2);
      expect(migration2RunMock).toHaveBeenCalledTimes(1);
      expect(migration1RunMock).not.toHaveBeenCalled();
      expect(migration4RunMock).not.toHaveBeenCalled();
    });
    it("should run migration 4 and not the others", async function () {
      await service.runMigration(4);
      expect(migration4RunMock).toHaveBeenCalledTimes(1);
      expect(migration1RunMock).not.toHaveBeenCalled();
      expect(migration2RunMock).not.toHaveBeenCalled();
    });
  });
});
