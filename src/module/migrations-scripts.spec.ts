import { Test, TestingModule } from "@nestjs/testing";
import { MigrationsScripts } from "./migrations-scripts.provider";
import { IMigrationScript } from "./interfaces/migration-script.interface";

class MigrationScriptFixture implements IMigrationScript {
  public async run() {}
}

describe("MigrationsScripts", function () {
  let service: MigrationsScripts;
  const migrationScriptsFixture = [
    new MigrationScriptFixture(),
    new MigrationScriptFixture(),
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

  describe("getAvailableMigrations", function () {
    it("should return a map of the same length of the migrations scripts passed in constructor", function () {
      expect(service.getAvailableMigrations().length).toEqual(
        migrationScriptsFixture.length
      );
    });
  });
});
