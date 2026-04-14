declare module "mermaid" {
  interface Mermaid {
    initialize(config: Record<string, unknown>): void;
    render(id: string, code: string): Promise<{ svg: string }>;
  }
  const mermaid: Mermaid;
  export default mermaid;
}
