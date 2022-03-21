import { DynamicModule, ForwardReference, Type } from "@nestjs/common";

export type IExternalOptions = {
  mongodb_url: string;
  imports: (
    | DynamicModule
    | Type<any>
    | Promise<DynamicModule>
    | ForwardReference<any>
  )[];
  scripts: any[];
};
