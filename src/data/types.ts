export interface Model {
  name: string;
}

export interface Provider {
  name: string;
  displayName: string;
  models: Model[];
}

export interface ProvidersData {
  providers: Provider[];
}
