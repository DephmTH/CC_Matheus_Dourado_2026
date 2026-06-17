# CC_Matheus_Dourado_2026
Criação de um sistema para a matéria de "Desenvolvimento de Sistemas" do 7° Período de Ciência da Computação.

O ERP Nacional Nexora Global é um Sistema Integrado de Gestão Empresarial (ERP) de alta fidelidade, arquitetado para o setor B2B. Ele atua como o núcleo operacional central de uma empresa, unificando a cadeia de suprimentos, faturamento descentralizado, rastreabilidade logística e inteligência de vendas (CRM) em uma única plataforma.

Construído sob os rigores da engenharia de software moderna, o sistema opera como uma Single Page Application (SPA) no frontend, consumindo uma API RESTful de alta performance focada em eventos transacionais, segurança criptográfica e análises preditivas.

# Finalidade e Caso de uso
A finalidade principal do projeto é resolver o desafio da gestão descentralizada em cenários logísticos e comerciais complexos. O sistema permite que uma empresa não apenas gerencie seu próprio estoque e faturamento (Matriz), mas também integre Empresas Filiadas (Afiliados) e vendedores externos sob o mesmo guarda-chuva de regras de negócio, centralizando a emissão de Notas Fiscais, cálculo de fretes, comissionamentos e monitoramento de KPIs em tempo real.

# Principais Funcionalidades
Faturamento Polimórfico: Motor de vendas inteligente que permite a emissão de Notas Fiscais tanto pela Matriz quanto por filiadas terceirizadas, com geração nativa de DANFE em PDF contendo cabeçalhos dinâmicos.

Modelagem Financeira em 3NF: Arquitetura de banco de dados estritamente normalizada para Formas de Pagamento, Condições e Parcelamentos, garantindo integridade referencial total sem redundância de dados.

Inteligência Artificial (Credit Scoring): Integração com um modelo real de Deep Learning (Multi-Layer Perceptron via Scikit-Learn). A IA analisa a recência, frequência e o LTV do cliente para cuspir uma predição matemática exata do risco de inadimplência antes de novas vendas.

CRM Estratégico: Motor estatístico que classifica a carteira de clientes automaticamente utilizando a Curva ABC (Princípio de Pareto), calculando o Lifetime Value (LTV) e plotando gráficos de retenção.

Segurança Corporativa: Sistema blindado com autenticação OAuth2 baseada em Tokens JWT (JSON Web Tokens), incluindo uma trilha de auditoria contínua (Audit Logs) que registra IPs e tentativas de acesso.

Acessibilidade Dinâmica: Interface de usuário construída com foco em UX/UI, suportando persistência de estado em memória (Cache local), Modo Escuro (Dark Mode), esquema de Baixo Contraste e redimensionamento dinâmico de fontes (WCAG).

# Stack Tecnológica
Backend: Python, FastAPI, SQLAlchemy (ORM), Scikit-Learn (Machine Learning), PyJWT (Criptografia), WeasyPrint (Geração de PDFs).

Frontend: HTML5, CSS3, Vanilla JavaScript (ES6+), ApexCharts (Data Visualization).

Arquitetura: REST API, SPA, SQLite (Banco de Dados Relacional).
