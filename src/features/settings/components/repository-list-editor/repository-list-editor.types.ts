export interface RepositoryListEditorProps {
  values: readonly string[];
  errors?: Partial<Record<number, string>>;
  onChange: (values: string[]) => void;
}
