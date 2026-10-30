# Atelier 3D Portal

Plataforma de gestão empresarial do **Atelier 3D** (impressão 3D **FDM**, Portugal): site público, área de clientes,
CRM, orçamentos com simulador FDM, modelação 3D, encomendas, produção, impressoras e materiais, financeiro e relatórios.

- Domínio: `portal.atelier3d.pt` · A loja `www.atelier3d.pt` (Shopify) é independente e **sem integração**.
- Sem produtos, carrinho ou loja online. Só FDM (sem SLA nem resina).
- Stack: Next.js · React · TypeScript · Tailwind · Supabase (PostgreSQL, Auth, Storage, RLS) · GitHub. Ferramentas gratuitas e abertas.

**Estado: Fase 0 (fundação técnica) implementada e testada localmente, a aguardar validação.** Ver [docs/ROADMAP.md](docs/ROADMAP.md).

## Desenvolvimento (sessões cloud)
```bash
pnpm install
pnpm check            # lint + tipos + testes (unitários, arquitetura, base de dados)
pnpm backup:verify    # backup cifrado + restauro verificado
pnpm build
pnpm dev              # http://localhost:3000 (a Fase 0 só mostra a página de estado)
```
Os testes de BD precisam de PostgreSQL 16 local (ver [CLAUDE.md](CLAUDE.md)); o CI fornece um.

## Documentação
| Documento | Conteúdo |
|---|---|
| [ROADMAP](docs/ROADMAP.md) | 11 fases: objetivos, funcionalidades, BD, testes, critérios |
| [ARQUITETURA](docs/ARQUITETURA.md) | Camadas, módulos, segurança, convenções, design |
| [SEGURANCA](docs/SEGURANCA.md) | Controlos testados e lacunas, RGPD |
| [SUPABASE](docs/SUPABASE.md) | Configuração, migrações, primeiro administrador |
| [BACKUPS](docs/BACKUPS.md) | Backups cifrados e restauro |
| [DECISOES-PENDENTES](docs/DECISOES-PENDENTES.md) | O que depende do proprietário |
| [REINICIO](docs/REINICIO.md) | O que foi eliminado/aproveitado e como recuperar a versão anterior |
