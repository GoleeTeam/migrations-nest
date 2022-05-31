import { Test, TestingModule } from "@nestjs/testing";
import { MigrationsRunner } from "./migration-runner.service";
import { getModelToken } from "@nestjs/mongoose";
import { MigrationsScripts } from "./migrations-scripts.provider";
import { MigrationVersionRepo } from "./schemas/migration-version.repo";

describe("MigrationsRunner", () => {
  let service: MigrationsRunner;
  const getAvailableMigrationMock = jest.fn();
  const scriptRunMigrationMock = jest.fn();

  const getCurrentVersionMock = jest.fn();
  const setCurrentVersionMock = jest.fn();
  const getMigrationLock = jest.fn();
  const saveMigrationLock = jest.fn();
  const setLastRunCompletedMock = jest.fn();
  const setLastRunErrorMock = jest.fn();

  afterEach(() => {
    jest.resetAllMocks();
  });

  beforeEach(async () => {
    getAvailableMigrationMock.mockReturnValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MigrationsRunner,
        {
          provide: getModelToken("MigrationVersion"),
          useValue: {
            findOne: jest.fn(),
            updateOne: jest.fn(),
          },
        },
        {
          provide: MigrationsScripts,
          useValue: {
            getAvailableMigrationsVersions: getAvailableMigrationMock,
            runMigration: scriptRunMigrationMock,
          },
        },
        {
          provide: MigrationVersionRepo,
          useValue: {
            getCurrentVersion: getCurrentVersionMock,
            setCurrentVersion: setCurrentVersionMock,
            getMigrationLock: getMigrationLock,
            saveMigrationLock: saveMigrationLock,
            setLastRunCompleted: setLastRunCompletedMock,
            setLastRunError: setLastRunErrorMock,
          },
        },
      ],
    }).compile();

    service = module.get<MigrationsRunner>(MigrationsRunner);
  });

  function givenAMigration() {
    getAvailableMigrationMock.mockReturnValue([1]);
    getCurrentVersionMock.mockResolvedValue(0);
  }

  describe("runMigrations", function () {
    it("should run no migration", async () => {
      getAvailableMigrationMock.mockReturnValue([]);
      getCurrentVersionMock.mockResolvedValue(undefined);

      const expected_migrations_run = [];
      expect(await service.runMigrations()).toEqual(expected_migrations_run);
    });

    it("should run one migration and skip one", async () => {
      getAvailableMigrationMock.mockReturnValue([1, 2, 3, 4]);
      getCurrentVersionMock.mockResolvedValue(2);

      const expected_migrations_run = [3, 4];
      expect(await service.runMigrations()).toEqual(expected_migrations_run);
    });

    it("should run one migration", async () => {
      givenAMigration();

      await service.runMigrations();
      expect(scriptRunMigrationMock).toBeCalledWith(1);
    });

    it("should run multiple migrations", async () => {
      getAvailableMigrationMock.mockReturnValue([1, 2]);
      getCurrentVersionMock.mockResolvedValue(0);

      await service.runMigrations();
      expect(scriptRunMigrationMock).toBeCalledWith(1);
      expect(scriptRunMigrationMock).toBeCalledWith(2);
    });

    it("should run one migration and increase current version", async () => {
      givenAMigration();

      expect(await service.runMigrations()).toEqual([1]);
      expect(setCurrentVersionMock).toBeCalledWith(1);
    });

    it("should not increase current varsion in case of failure", async () => {
      givenAMigration();
      scriptRunMigrationMock.mockRejectedValue(new Error("Script failed"));

      expect(await service.runMigrations()).toEqual([]);
      expect(setCurrentVersionMock).toBeCalledTimes(0);
    });

    it("should not run other migration if one fails", async () => {
      getAvailableMigrationMock.mockReturnValue([1, 2]);
      getCurrentVersionMock.mockResolvedValue(0);
      scriptRunMigrationMock.mockRejectedValue(new Error("Script failed"));

      expect(await service.runMigrations()).toEqual([]);
      expect(scriptRunMigrationMock).toBeCalledTimes(1);
    });

    it("should not run a migration if another process is already running migration", async () => {
      givenAMigration();
      getMigrationLock.mockResolvedValue(1);

      await service.runMigrations();
      expect(scriptRunMigrationMock).not.toBeCalled();
    });

    it("should set last run completed to false in case of failure", async () => {
      givenAMigration();
      scriptRunMigrationMock.mockRejectedValue(new Error("Script failed"));

      expect(await service.runMigrations()).toEqual([]);
      expect(setLastRunCompletedMock).toBeCalledWith(false);
    });

    it("should set last error in case of failure", async () => {
      givenAMigration();
      scriptRunMigrationMock.mockRejectedValue(new Error("Script failed"));

      expect(await service.runMigrations()).toEqual([]);
      expect(setLastRunErrorMock).toBeCalledWith("Script failed");
    });

    it("should set last run completed to true in case of success", async () => {
      givenAMigration();

      await service.runMigrations();
      expect(setLastRunCompletedMock).toBeCalledWith(true);
    });

    it("should set last error as empty in case of failure", async () => {
      givenAMigration();

      await service.runMigrations();
      expect(setLastRunErrorMock).toBeCalledWith("");
    });
  });
});