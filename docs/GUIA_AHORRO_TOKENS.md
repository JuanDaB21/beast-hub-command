# Guía de ahorro de tokens y contexto con Claude Code

Abanico de herramientas evaluadas + cuándo usar cada una. **Todas las de terceros se
instalan solo con tu aprobación**: un plugin o servidor MCP puede ver y reescribir las
llamadas y resultados de herramientas, y los instaladores (`curl|bash`, `pip`, `npx`)
ejecutan código remoto. Antes de instalar, revisa el repositorio.

> Regla práctica: **no** instales varias que registren hooks `PreToolUse/PostToolUse` a la
> vez (se pisan). Elige UNA base y añade complementos puntuales.

## Base recomendada (curada)

### 1. Config propia de concisión — YA APLICADA (sin terceros)
- `~/.claude/CLAUDE.md` (global): reglas de respuesta concisa.
- `CLAUDE.md` por proyecto: contexto fijo para no re-derivarlo.
- Generación *data-driven* (config + script) para documentos repetibles.
Cero riesgo, sin instaladores. Es lo que más rinde en proyectos de documentos.

### 2. context-mode — plugin base recomendado
Sandbox de salida de herramientas (315 KB → 5.4 KB, ~98%), memoria de sesión (SQLite/FTS5)
que sobrevive a la compactación, y análisis "code-first". Instalación nativa en una
terminal `claude` interactiva:
```
/plugin marketplace add mksglu/context-mode
/plugin install context-mode@context-mode
```
Repo: https://github.com/mksglu/context-mode

### 3. rtk (opcional, complemento) — compresor de salida de bash
Binario que comprime la salida de git/docker/pytest hasta ~90%. Útil si trabajas mucho
en terminal, además del plugin base.
```
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
rtk init -g
```
Repo: https://github.com/rtk-ai/rtk

## Alternativas y por-proyecto (activar según el caso)

| Herramienta | Tipo | Cuándo usarla | Instalar |
|---|---|---|---|
| **token-optimizer-mcp** | Plugin/MCP | Alternativa a context-mode: `smart_read/grep/glob/edit` (cachea, devuelve diffs 60-90%) + capa que bloquea lecturas costosas + grafo de conocimiento | `/plugin marketplace add ooples/token-optimizer-mcp` → `/plugin install token-optimizer@token-optimizer` |
| **caveman** | Skill + proxy | Skill de salida concisa multi-agente; el proxy comprime lecturas | `npx skills add JuliusBrussee/caveman` |
| **token-savior** | MCP (pip) | Repos de código: grafo de símbolos + memoria SQLite + reescritura de bash | `pip install "token-savior-recall[mcp]"` → `ts init` |
| **code-review-graph** | CLI/MCP (pip) | Revisión de código: grafo AST + blast-radius (lee solo lo afectado); ~65× menos tokens por consulta | `pip install code-review-graph` → `code-review-graph install && build` |
| **claude-token-optimizer** | CLI (npm) | Repos con muchos docs: separa docs en auto-cargados vs on-demand | `npx claude-token-optimizer init` |
| **claude-token-efficient** | `CLAUDE.md` | Reglas de concisión listas (ya cubiertas por tu `~/.claude/CLAUDE.md`) | copiar su `CLAUDE.md` |
| **claude-context** | MCP | Repos de código GRANDES: búsqueda semántica (BM25 + embeddings). **Requiere API key de embeddings + base vectorial Milvus/Zilliz** | `claude mcp add claude-context -e OPENAI_API_KEY=… -e MILVUS_ADDRESS=… -- npx @zilliz/claude-context-mcp@latest` |

## Qué aplica a proyectos de DOCUMENTOS (como éste)
Los tolos de navegación AST/semántica/grafo (claude-context, code-review-graph, token-savior)
aportan poco: no hay codebase que recorrer. Lo que rinde:
- `CLAUDE.md` de proyecto con el contexto fijo.
- Generación data-driven (config + script) para regenerar barato.
- Extraer los binarios a JSON/texto una sola vez.
- context-mode ayuda si manejas salidas grandes de comandos/scripts.

## Qué aplica a proyectos de CÓDIGO
- Base: context-mode **o** token-optimizer-mcp (una sola).
- Añade code-review-graph para revisiones; claude-context si el repo es muy grande.
- rtk para comprimir salidas de terminal.

## Notas
- El post de token-saving (X/@felpscrypto) no es accesible sin sesión iniciada; su principio
  (generación parametrizada para evitar re-trabajo del modelo) ya está aplicado. Si lo pegas
  aquí, se incorporan sus técnicas puntuales.
- Referencia general de recursos: https://github.com/hesreallyhim/awesome-claude-code
