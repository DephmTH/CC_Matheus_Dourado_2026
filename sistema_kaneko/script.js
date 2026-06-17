let chartReceita, chartFiliais, chartRisco, chartCurvaABC, chartRetencao;
let carrinhoNFe = [];
let cacheProdutos = [], cacheFornecedores = [], cacheTransportadoras = [], cacheAfiliados = [], cacheFuncionarios = [], cacheClientesCRM = [], cacheNotasFiscais = [];
let cacheFormasPagamento = [], cacheCondicoesPagamento = [];
let parcelasCondicaoTemp = []; 

let modoEdicao = { produtos: null, fornecedores: null, transportadoras: null, afiliados: null, funcionarios: null, clientes: null };
let listenersInjetados = false;
const API_BASE_URL = "http://localhost:8000/api";

// ==========================================
// FUNÇÕES DE ACESSIBILIDADE E TEMA
// ==========================================
let nivelFonte = 0;

function aplicarAcessibilidadeSalva() {
    if (localStorage.getItem('proversatil_darkmode') === 'true') document.body.classList.add('dark-mode');
    if (localStorage.getItem('proversatil_baixo_contraste') === 'true') document.body.classList.add('low-contrast');
    
    const fonteSalva = localStorage.getItem('proversatil_fonte');
    if (fonteSalva) {
        nivelFonte = parseInt(fonteSalva);
        mudarTamanhoFonte(0); 
    }
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('proversatil_darkmode', document.body.classList.contains('dark-mode'));
    atualizarGraficosTema();
}

function toggleBaixoContraste() {
    document.body.classList.toggle('low-contrast');
    localStorage.setItem('proversatil_baixo_contraste', document.body.classList.contains('low-contrast'));
}

function mudarTamanhoFonte(passo) {
    nivelFonte += passo;
    if (nivelFonte < -1) nivelFonte = -1;
    if (nivelFonte > 1) nivelFonte = 1;
    
    document.body.classList.remove('font-small', 'font-large');
    
    if (nivelFonte === -1) document.body.classList.add('font-small');
    if (nivelFonte === 1) document.body.classList.add('font-large');
    
    localStorage.setItem('proversatil_fonte', nivelFonte);
}

function atualizarGraficosTema() {
    const isDark = document.body.classList.contains('dark-mode');
    const configTema = { mode: isDark ? 'dark' : 'light' };
    const configBg = isDark ? '#1e293b' : '#ffffff';

    if (chartReceita) chartReceita.updateOptions({ theme: configTema, chart: { background: 'transparent' } });
    if (chartFiliais) chartFiliais.updateOptions({ theme: configTema, chart: { background: 'transparent' } });
    if (chartRisco) chartRisco.updateOptions({ theme: configTema, chart: { background: 'transparent' } });
    if (chartCurvaABC) chartCurvaABC.updateOptions({ theme: configTema, chart: { background: 'transparent' } });
    if (chartRetencao) chartRetencao.updateOptions({ theme: configTema, chart: { background: 'transparent' } });
}

// ==========================================
// NÚCLEO DO SISTEMA
// ==========================================
async function apiFetch(url, options = {}) {
    const token = sessionStorage.getItem('proversatil_token');
    const headers = { ...options.headers };
    
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!headers['Content-Type'] && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    
    options.headers = headers;
    const response = await fetch(url, options);
    
    if (response.status === 401 || response.status === 403) {
        Swal.fire('Sessão Expirada', 'A sua chave de segurança expirou ou é inválida. Faça login novamente.', 'warning');
        fazerLogout();
        throw new Error("Token Invalido");
    }
    return response;
}

document.addEventListener("DOMContentLoaded", () => {
    aplicarAcessibilidadeSalva();
    verificarLogin();
    const mesDashInput = document.getElementById("mesDashboard");
    if (mesDashInput) {
        flatpickr("#mesDashboard", { locale: "pt", plugins: [new monthSelectPlugin({ shorthand: true, dateFormat: "Y-m", altFormat: "F Y" })], altInput: true, defaultDate: "today", onChange: () => carregarDadosDashboardNacional() });
    }
    inicializarMascaras();
    inicializarEventosFormulariosCadastro(); 

    const formLogin = document.getElementById('formLogin');
    if (formLogin) {
        formLogin.addEventListener('submit', async function(e) {
            e.preventDefault(); 
            await fazerLogin();
        });
    }
});

function inicializarMascaras() {
    document.querySelectorAll('.moeda').forEach(campo => {
        campo.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, "");
            v = (v / 100).toFixed(2).replace(".", ",");
            v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
            e.target.value = "R$ " + v;
        });
    });

    document.querySelectorAll('.mascara-cpfcnpj').forEach(campo => {
        campo.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, "");
            if (v.length > 14) v = v.substring(0, 14); 
            if (v.length <= 11) { 
                v = v.replace(/(\d{3})(\d)/, "$1.$2");
                v = v.replace(/(\d{3})(\d)/, "$1.$2");
                v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
            } else { 
                v = v.replace(/^(\d{2})(\d)/, "$1.$2");
                v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
                v = v.replace(/\.(\d{3})(\d)/, ".$1/$2");
                v = v.replace(/(\d{4})(\d{1,2})$/, "$1-$2");
            }
            e.target.value = v;
        });
    });

    document.querySelectorAll('.mascara-telefone').forEach(campo => {
        campo.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, "");
            if (v.length > 11) v = v.substring(0, 11);
            if (v.length > 10) {
                v = v.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
            } else if (v.length > 5) {
                v = v.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
            } else if (v.length > 2) {
                v = v.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
            } else if (v.length > 0) {
                v = v.replace(/^(\d{0,2})/, "($1");
            }
            e.target.value = v;
        });
    });
}

function converterParaNumero(s) { return parseFloat((s||"").replace("R$ ", "").replace(/\./g, "").replace(",", ".")) || 0; }

async function buscarCNPJ(documentoFormatado, idInputNome, idInputEndereco) {
    const cnpj = documentoFormatado.replace(/\D/g, ''); 
    if (cnpj.length === 14) {
        Swal.fire({ title: 'Buscando Dados...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });
        try {
            const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
            if (res.ok) {
                const data = await res.json();
                const campoNome = document.getElementById(idInputNome);
                const campoEndereco = document.getElementById(idInputEndereco);
                if (campoNome) campoNome.value = data.razao_social;
                if (campoEndereco && data.logradouro) campoEndereco.value = `${data.logradouro}, ${data.numero} - ${data.municipio}/${data.uf}`;
                Swal.close();
                Swal.fire({ title: 'CNPJ Encontrado!', text: 'Dados preenchidos.', icon: 'success', toast: true, position: 'top-end', timer: 3000, showConfirmButton: false });
            } else { Swal.close(); }
        } catch (e) { Swal.close(); }
    }
}

function verificarLogin() {
    const token = sessionStorage.getItem('proversatil_token');
    const loginScreen = document.getElementById('login-screen');
    const mainApp = document.getElementById('main-app');
    if (token) {
        if (loginScreen) loginScreen.style.display = 'none';
        if (mainApp) mainApp.style.display = 'flex';
        const abaSalva = localStorage.getItem('proversatil_aba') || 'dashboard';
        setTimeout(() => { mudarAba(abaSalva); }, 150); 
    } else {
        if (loginScreen) loginScreen.style.display = 'flex'; 
        if (mainApp) mainApp.style.display = 'none';
    }
}

async function fazerLogin() { 
    try { 
        const u = document.getElementById('usuarioLogin').value;
        const s = document.getElementById('senhaLogin').value;
        
        const response = await fetch(`${API_BASE_URL}/login/`, { 
            method: "POST", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({ usuario: u, senha: s }) 
        }); 
        
        if (response.ok) { 
            const data = await response.json(); 
            sessionStorage.setItem('proversatil_token', data.token); 
            document.getElementById('formLogin').reset(); 
            verificarLogin(); 
        } else { 
            const err = await response.json();
            Swal.fire({ title: 'Acesso Negado', text: err.detail || 'Usuário ou senha incorretos.', icon: 'error', confirmButtonColor: '#ef4444' }); 
        } 
    } catch(err) { 
        Swal.fire('Erro Crítico', 'Servidor backend offline.', 'error'); 
    } 
}

function fazerLogout() { sessionStorage.removeItem('proversatil_token'); verificarLogin(); }

function mudarAba(idAba, elemento) {
    document.querySelectorAll('.aba-conteudo').forEach(a => a.classList.remove('ativa'));
    document.querySelectorAll('.sidebar-nav li').forEach(l => l.classList.remove('active'));
    const abaAlvo = document.getElementById(idAba);
    if(abaAlvo) abaAlvo.classList.add('ativa');
    if(elemento) { elemento.classList.add('active'); } 
    else { const botao = Array.from(document.querySelectorAll('.sidebar-nav li')).find(li => li.getAttribute('onclick') && li.getAttribute('onclick').includes(idAba)); if(botao) botao.classList.add('active'); }
    
    localStorage.setItem('proversatil_aba', idAba);
    
    if(idAba === 'dashboard') carregarDadosDashboardNacional();
    else if(idAba === 'crm') carregarListaClientes();
    else if(idAba === 'cadastros') { carregarCadastrosGerais(); }
    else if(idAba === 'nova-os') prepararPainelVendas();
    else if(idAba === 'lista-os') carregarHistoricoNotas();
}

async function abrirModalLogs() {
    Swal.fire({ title: 'Buscando Logs...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    try {
        const res = await apiFetch(`${API_BASE_URL}/logs_acesso/?t=${new Date().getTime()}`);
        if(res.ok) {
            const logs = await res.json();
            const tbody = document.getElementById('corpoTabelaLogs');
            tbody.innerHTML = '';
            
            if(logs.length === 0) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">Nenhum registro de acesso encontrado.</td></tr>';
            
            logs.forEach(l => {
                let corStatus = l.status.includes('Sucesso') ? '#10b981' : '#ef4444';
                tbody.innerHTML += `
                    <tr>
                        <td>${new Date(l.data_hora).toLocaleString('pt-BR')}</td>
                        <td><strong>${l.usuario_tentativa}</strong></td>
                        <td>${l.ip_origem}</td>
                        <td><span style="color: ${corStatus}; font-weight: bold;">${l.status}</span></td>
                    </tr>
                `;
            });
            Swal.close();
            document.getElementById('modalLogs').style.display = 'flex';
        }
    } catch(e) { Swal.fire('Erro', 'Não foi possível carregar a auditoria.', 'error'); }
}

async function carregarDadosDashboardNacional() {
    try {
        const valMes = document.getElementById('mesDashboard').value;
        const mes = valMes ? valMes : 'geral';
        
        const res = await apiFetch(`${API_BASE_URL}/dashboard/?mes=${mes}&t=${new Date().getTime()}`);
        if(res.ok) {
            const d = await res.json();
            if(document.getElementById('kpi-faturamento')) {
                document.getElementById('kpi-faturamento').innerText = `R$ ${d.faturamentoTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
                document.getElementById('kpi-frete').innerText = `R$ ${d.custoFrete.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
                document.getElementById('kpi-afiliados').innerText = `R$ ${d.comissoes.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
                document.getElementById('kpi-pedidos').innerText = d.totalPedidos;
                document.getElementById('kpi-risco').innerText = `${d.riscoInadimplencia}%`;

                renderizarGraficoReceita(d.dias, d.receitaDiaria, d.freteDiario);
                renderizarGraficoFiliais(d.filiaisVendas, d.filiaisNomes);
                renderizarGraficoRisco(d.metricasCredito, d.scoreMedio);
                
                const lista = document.getElementById('listaRankingAfiliados');
                lista.innerHTML = '';
                if(d.topAfiliados.length === 0) lista.innerHTML = '<li style="text-align:center; padding: 20px;">Nenhuma venda afiliada.</li>';
                d.topAfiliados.forEach((afil, index) => {
                    let corBadge = index === 0 ? '#f59e0b' : index === 1 ? '#94a3b8' : index === 2 ? '#d97706' : '#3b82f6';
                    lista.innerHTML += `<li style="border-left: 4px solid ${corBadge};"><div><strong style="color: var(--text-main); display: block; font-size: 15px;">${index + 1}º - ${afil.nome}</strong><span style="font-size: 12px; color: var(--text-muted);">Código: ${afil.codigo}</span></div><div style="text-align: right;"><span class="badge" style="background: #f1f5f9; color: #0f172a;">${afil.vendas} Pedidos</span></div></li>`;
                });
            }
        }
    } catch(err) {}
}

function renderizarGraficoReceita(dias, receita, frete) {
    if (chartReceita) chartReceita.destroy();
    if (!document.querySelector("#graficoReceita")) return;
    
    const isDark = document.body.classList.contains('dark-mode');
    
    chartReceita = new ApexCharts(document.querySelector("#graficoReceita"), { 
        series: [{ name: 'Faturamento Bruto', data: receita }, { name: 'Custo Frete', data: frete }], 
        chart: { type: 'area', height: 320, toolbar: { show: false }, fontFamily: 'Inter, sans-serif', background: 'transparent' }, 
        theme: { mode: isDark ? 'dark' : 'light' },
        colors: ['#f97316', '#64748b'], dataLabels: { enabled: false }, stroke: { curve: 'smooth', width: 2 }, 
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 100] } }, 
        xaxis: { categories: dias, tooltip: { enabled: false } }, 
        yaxis: { 
            labels: { 
                formatter: function (v) { 
                    if (v >= 1000000) return "R$ " + (v / 1000000).toFixed(2).replace('.', ',') + "M";
                    if (v >= 1000) return "R$ " + (v / 1000).toFixed(0) + "k";
                    return "R$ " + v.toString();
                } 
            } 
        }, 
        legend: { position: 'top', horizontalAlign: 'right' }, grid: { borderColor: isDark ? '#334155' : '#e2e8f0', strokeDashArray: 4 } 
    });
    chartReceita.render();
}

function renderizarGraficoFiliais(valores, categorias) {
    if (chartFiliais) chartFiliais.destroy();
    if (!document.querySelector("#graficoFiliais")) return;

    let totalValores = valores.reduce((acc, curr) => acc + curr, 0);
    const isDark = document.body.classList.contains('dark-mode');

    chartFiliais = new ApexCharts(document.querySelector("#graficoFiliais"), { 
        series: valores, 
        chart: { type: 'donut', height: 300, fontFamily: 'Inter, sans-serif', background: 'transparent' }, 
        theme: { mode: isDark ? 'dark' : 'light' },
        labels: categorias, 
        colors: ['#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#8b5cf6', '#ef4444'], 
        plotOptions: { 
            pie: { 
                donut: { 
                    size: '70%', 
                    labels: { 
                        show: true, 
                        name: { show: true }, 
                        value: { 
                            formatter: function (val) { 
                                if(totalValores === 0) return "0%";
                                return ((val / totalValores) * 100).toFixed(1) + "%"; 
                            } 
                        }, 
                        total: { 
                            show: true, 
                            label: 'Total Faturado',
                            formatter: function () {
                                return "R$ " + totalValores.toLocaleString('pt-BR', {minimumFractionDigits: 2});
                            }
                        } 
                    } 
                } 
            } 
        }, 
        tooltip: {
            y: {
                formatter: function(val) {
                    if (totalValores === 0) return "0%";
                    let percent = ((val / totalValores) * 100).toFixed(1) + "%";
                    return `${percent} (R$ ${val.toLocaleString('pt-BR', {minimumFractionDigits: 2})})`;
                }
            }
        },
        dataLabels: { enabled: false }, 
        legend: { show: false } 
    });
    chartFiliais.render();
}

function renderizarGraficoRisco(metricas, valores) {
    if (chartRisco) chartRisco.destroy();
    if (!document.querySelector("#graficoRiscoCredito")) return;
    
    const isDark = document.body.classList.contains('dark-mode');

    chartRisco = new ApexCharts(document.querySelector("#graficoRiscoCredito"), { 
        series: [{ name: 'Score', data: valores }], 
        chart: { type: 'radar', height: 320, fontFamily: 'Inter, sans-serif', toolbar: { show: false }, background: 'transparent' }, 
        theme: { mode: isDark ? 'dark' : 'light' },
        labels: metricas, stroke: { width: 2, colors: ['#ef4444'] }, fill: { opacity: 0.2, colors: ['#ef4444'] }, markers: { size: 4, colors: ['#fff'], strokeColors: '#ef4444', strokeWidth: 2 }, yaxis: { show: false, min: 0, max: 100 }, plotOptions: { radar: { polygons: { strokeColors: isDark ? '#334155' : '#e2e8f0', connectorColors: isDark ? '#334155' : '#e2e8f0' } } } 
    });
    chartRisco.render();
}

function exportarExcel() { 
    const val = document.getElementById('mesDashboard').value;
    const mes = val ? val : 'geral';
    window.location.href = `${API_BASE_URL}/relatorio/excel/${mes}`; 
}

async function carregarListaClientes() {
    Swal.fire({ title: 'Processando Inteligência...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    try {
        const [resCli, resNFe] = await Promise.all([ apiFetch(`${API_BASE_URL}/clientes/?t=${new Date().getTime()}`), apiFetch(`${API_BASE_URL}/notas_fiscais/?t=${new Date().getTime()}`) ]);
        cacheClientesCRM = await resCli.json();
        const notasFiscais = await resNFe.json();

        const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        let historicoMeses = {}; let ultimos6Meses = []; let labelsMeses = []; let hoje = new Date();
        
        for(let i=5; i>=0; i--) {
            let d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
            let key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}`;
            ultimos6Meses.push(key); labelsMeses.push(mesesNomes[d.getMonth()]); historicoMeses[key] = 0;
        }

        let receitaTotalGeral = 0; let totalPedidosGeral = 0;

        cacheClientesCRM.forEach(cliente => {
            const nfs = notasFiscais.filter(nf => nf.cliente_id === cliente.id);
            cliente.total_pedidos = nfs.length;
            cliente.ltv_total = nfs.reduce((acc, nf) => acc + nf.valor_total, 0);
            cliente.ticket_medio = cliente.total_pedidos > 0 ? (cliente.ltv_total / cliente.total_pedidos) : 0;
            cliente.historico = nfs.sort((a, b) => new Date(b.data_emissao) - new Date(a.data_emissao));
            
            if (cliente.historico.length > 0) {
                const diferencaTempo = Math.abs(new Date() - new Date(cliente.historico[0].data_emissao));
                cliente.recencia_dias = Math.ceil(diferencaTempo / (1000 * 60 * 60 * 24));
            } else { cliente.recencia_dias = "Inativo"; }

            receitaTotalGeral += cliente.ltv_total; totalPedidosGeral += cliente.total_pedidos;
        });

        notasFiscais.forEach(nf => {
            let dNf = new Date(nf.data_emissao);
            let key = `${dNf.getFullYear()}-${String(dNf.getMonth()+1).padStart(2, '0')}`;
            if(historicoMeses[key] !== undefined) { historicoMeses[key]++; }
        });
        
        let dataFrequencia = ultimos6Meses.map(k => historicoMeses[k]);

        cacheClientesCRM.sort((a, b) => b.ltv_total - a.ltv_total);
        let receitaAcumulada = 0; let cA = 0, cB = 0, cC = 0;

        cacheClientesCRM.forEach(c => {
            receitaAcumulada += c.ltv_total;
            const rep = (receitaAcumulada / (receitaTotalGeral || 1)) * 100;
            if (rep <= 80) { c.classificacao = "Cliente A (VIP)"; c.corClassificacao = "#10b981"; cA++; } 
            else if (rep <= 95) { c.classificacao = "Cliente B (Regular)"; c.corClassificacao = "#f59e0b"; cB++; } 
            else { c.classificacao = "Cliente C (Casual)"; c.corClassificacao = "#64748b"; cC++; }
        });

        if(document.getElementById('kpi-crm-total')){
            document.getElementById('kpi-crm-total').innerText = cacheClientesCRM.length;
            document.getElementById('kpi-crm-ticket').innerText = `R$ ${(totalPedidosGeral > 0 ? receitaTotalGeral / totalPedidosGeral : 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
            document.getElementById('kpi-crm-ltv').innerText = `R$ ${receitaTotalGeral.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;

            const corpo = document.getElementById('corpoTabelaCRM');
            corpo.innerHTML = '';
            cacheClientesCRM.forEach(c => {
                corpo.innerHTML += `<tr><td><strong>${c.nome}</strong><br><span style="font-size: 11px;">Doc: ${c.documento}</span></td><td><span class="badge" style="background: ${c.corClassificacao}20; color: ${c.corClassificacao}; border: 1px solid ${c.corClassificacao}50;">${c.classificacao}</span></td><td style="color: #64748b;">R$ ${c.ticket_medio.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td><td style="color: #10b981; font-weight: 700;">R$ ${c.ltv_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td><td><div class="acoes-container"><button class="btn-icone" style="background-color: #3b82f6;" onclick="prepararEdicaoBase('clientes', ${c.id})"><i class="ph ph-pencil"></i></button> <button class="btn-icone" style="background-color: #0f172a;" onclick="abrirModalCRM(${c.id})"><i class="ph ph-identification-card"></i></button></div></td></tr>`;
            });

            const isDark = document.body.classList.contains('dark-mode');

            if(chartCurvaABC) chartCurvaABC.destroy();
            chartCurvaABC = new ApexCharts(document.querySelector("#graficoCurvaABC"), { series: [cA, cB, cC], chart: { type: 'pie', height: 300, fontFamily: 'Inter, sans-serif', background: 'transparent' }, theme: { mode: isDark ? 'dark' : 'light' }, labels: ['Clientes A', 'Clientes B', 'Clientes C'], colors: ['#10b981', '#f59e0b', '#64748b'], legend: { position: 'bottom' } });
            chartCurvaABC.render();

            if(chartRetencao) chartRetencao.destroy();
            chartRetencao = new ApexCharts(document.querySelector("#graficoRetencao"), { series: [{ name: 'Volume de Pedidos (Geral)', data: dataFrequencia }], chart: { type: 'bar', height: 300, toolbar: { show: false }, fontFamily: 'Inter, sans-serif', background: 'transparent' }, theme: { mode: isDark ? 'dark' : 'light' }, colors: ['#3b82f6'], plotOptions: { bar: { borderRadius: 4, dataLabels: { position: 'top' } } }, xaxis: { categories: labelsMeses, axisBorder: { show: false }, axisTicks: { show: false } }, yaxis: { show: false }, grid: { show: false } });
            chartRetencao.render();
        }
        Swal.close();
    } catch (e) { Swal.close(); }
}

function abrirModalCRM(idCli) {
    const c = cacheClientesCRM.find(item => item.id === idCli);
    if (!c) return;
    let corRecencia = c.recencia_dias <= 30 ? "#10b981" : c.recencia_dias <= 90 ? "#f59e0b" : "#ef4444";
    let statusRecencia = c.recencia_dias === "Inativo" ? "Sem compras recentes" : `Há ${c.recencia_dias} dias`;

    document.getElementById('conteudoCRM').innerHTML = `<div class="detalhe-item"><strong><i class="ph ph-buildings"></i> Organização:</strong><br><span style="font-size: 16px;">${c.nome}</span><br><span>${c.documento}</span></div><div class="detalhe-item"><strong><i class="ph ph-map-pin"></i> Endereço:</strong><br>${c.endereco}</div><div class="detalhe-item" style="border-left-color: ${c.corClassificacao}; background: ${c.corClassificacao}10;"><strong><i class="ph ph-star"></i> LTV:</strong><br>Perfil: <strong style="color: ${c.corClassificacao};">${c.classificacao}</strong><br>LTV: <strong>R$ ${c.ltv_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}</strong></div><div class="detalhe-item"><strong><i class="ph ph-clock-counter-clockwise"></i> Frequência:</strong><br>Ticket: R$ ${c.ticket_medio.toLocaleString('pt-BR', {minimumFractionDigits:2})}<br>Última Compra: <strong style="color: ${corRecencia};">${statusRecencia}</strong></div>`;
    const tbody = document.getElementById('listaHistoricoCRM');
    tbody.innerHTML = '';
    if (c.historico.length === 0) tbody.innerHTML = `<tr><td colspan="4" style="text-align: center;">Nenhum registro.</td></tr>`;
    else {
        c.historico.forEach(nf => { let corStatus = nf.status_logistico === 'Entregue' ? '#10b981' : '#3b82f6'; tbody.innerHTML += `<tr><td><strong>${nf.numero_nf}</strong></td><td>${new Date(nf.data_emissao).toLocaleDateString('pt-BR')}</td><td><span style="color: ${corStatus}; font-weight: bold;">${nf.status_logistico}</span></td><td style="text-align: right; color: #10b981; font-weight: bold;">R$ ${nf.valor_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td></tr>`; });
    }
    document.getElementById('modalCRM').style.display = 'flex';
}

function alternarSubAbaCadastro(idSubAba) {
    document.querySelectorAll('.sub-cadastro-bloco').forEach(bloco => { bloco.style.display = 'none'; });
    const subAbaAlvo = document.getElementById(idSubAba);
    if (subAbaAlvo) subAbaAlvo.style.display = 'block';

    const botoesDiv = document.querySelector('#cadastros > div:first-of-type');
    if (botoesDiv) {
        botoesDiv.querySelectorAll('button').forEach(btn => {
            if (btn.getAttribute('onclick').includes(idSubAba)) { btn.style.background = '#0f172a'; } 
            else { btn.style.background = '#475569'; }
        });
    }
    localStorage.setItem('proversatil_sub_aba', idSubAba);
}

function removerParcelaTemp(index) {
    parcelasCondicaoTemp.splice(index, 1);
    parcelasCondicaoTemp.forEach((p, i) => { p.numero_parcela = i + 1; });
    renderizarTabelaParcelas();
}

function adicionarLinhaParcela() {
    const dias = parseInt(document.getElementById('parcelaDias').value);
    const perc = parseFloat(document.getElementById('parcelaPercentual').value);
    
    if (isNaN(dias) || isNaN(perc) || perc <= 0) {
        Swal.fire('Aviso', 'Preencha os dias e o percentual validamente.', 'warning');
        return;
    }
    
    parcelasCondicaoTemp.push({ numero_parcela: parcelasCondicaoTemp.length + 1, dias_vencimento: dias, percentual: perc });
    document.getElementById('parcelaDias').value = '';
    document.getElementById('parcelaPercentual').value = '';
    renderizarTabelaParcelas();
}

function renderizarTabelaParcelas() {
    const tbody = document.getElementById('listaParcelasCriadas');
    if(!tbody) return;
    tbody.innerHTML = '';
    let totalPerc = 0;
    
    parcelasCondicaoTemp.forEach((p, index) => {
        totalPerc += p.percentual;
        tbody.innerHTML += `
            <tr>
                <td style="padding: 5px;">Parcela ${p.numero_parcela}</td>
                <td style="padding: 5px;">${p.dias_vencimento} Dias</td>
                <td style="text-align: right; padding: 5px;">${p.percentual.toFixed(2)}%</td>
                <td style="text-align: right; padding: 5px;">
                    <button type="button" class="btn-icone" style="background-color: #ef4444; width: 24px; height: 24px; min-height: 24px; padding: 0; display: inline-flex; align-items: center; justify-content: center;" onclick="removerParcelaTemp(${index})"><i class="ph ph-trash" style="font-size: 14px;"></i></button>
                </td>
            </tr>`;
    });
    
    if(parcelasCondicaoTemp.length > 0) {
        let corT = totalPerc > 100.1 || totalPerc < 99.9 ? '#ef4444' : '#10b981';
        tbody.innerHTML += `<tr style="border-top: 1px solid #cbd5e1; font-weight: bold;"><td colspan="2" style="padding: 5px;">Total</td><td style="text-align: right; padding: 5px; color: ${corT};">${totalPerc.toFixed(2)}%</td><td></td></tr>`;
    }
}

async function carregarCadastrosGerais() {
    Swal.fire({ title: 'Sincronizando Matriz...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    try {
        const [resMatriz, resProd, resForn, resTransp, resAfil, resFunc, resFormas, resConds] = await Promise.all([
            apiFetch(`${API_BASE_URL}/matriz/?t=${new Date().getTime()}`), apiFetch(`${API_BASE_URL}/produtos/?t=${new Date().getTime()}`), 
            apiFetch(`${API_BASE_URL}/fornecedores/?t=${new Date().getTime()}`), apiFetch(`${API_BASE_URL}/transportadoras/?t=${new Date().getTime()}`),
            apiFetch(`${API_BASE_URL}/afiliados/?t=${new Date().getTime()}`), apiFetch(`${API_BASE_URL}/funcionarios/?t=${new Date().getTime()}`),
            apiFetch(`${API_BASE_URL}/formas_pagamento/?t=${new Date().getTime()}`), apiFetch(`${API_BASE_URL}/condicoes_pagamento/?t=${new Date().getTime()}`)
        ]);

        const matriz = await resMatriz.json();
        cacheProdutos = await resProd.json(); cacheFornecedores = await resForn.json(); cacheTransportadoras = await resTransp.json(); 
        cacheAfiliados = await resAfil.json(); cacheFuncionarios = await resFunc.json();
        cacheFormasPagamento = await resFormas.json(); cacheCondicoesPagamento = await resConds.json();
        Swal.close();

        if (document.getElementById('matrizNome')) {
            document.getElementById('matrizNome').value = matriz.nome; document.getElementById('matrizRazao').value = matriz.razao_social;
            document.getElementById('matrizCnpj').value = matriz.cnpj; document.getElementById('matrizEndereco').value = matriz.endereco;
            document.getElementById('matrizTelefone').value = matriz.telefone;
        }

        const selForma = document.getElementById('condFormaId');
        if(selForma) {
            selForma.innerHTML = '<option disabled selected value="">Selecione...</option>';
            cacheFormasPagamento.forEach(f => { selForma.innerHTML += `<option value="${f.id}">${f.nome}</option>`; });
        }
        
        const tabFormas = document.getElementById('tabelaFormasPagamento');
        if(tabFormas) {
            tabFormas.innerHTML = '';
            cacheFormasPagamento.forEach(f => { tabFormas.innerHTML += `<tr><td><strong>${f.nome}</strong></td></tr>`; });
        }

        const tabConds = document.getElementById('tabelaCondicoesPagamento');
        if(tabConds) {
            tabConds.innerHTML = '';
            cacheCondicoesPagamento.forEach(c => { tabConds.innerHTML += `<tr><td><strong>${c.descricao}</strong></td><td>${c.parcelas.length}x</td><td style="text-align: right;"><button type="button" class="btn-icone" style="background-color: #ef4444;" onclick="deletarEntidadeBase('condicoes_pagamento', ${c.id})"><i class="ph ph-trash"></i></button></td></tr>`; });
        }

        const seletorForn = document.getElementById('prodFornecedorId');
        if (seletorForn) { seletorForn.innerHTML = '<option disabled selected value="">Escolha o fornecedor...</option>'; cacheFornecedores.forEach(f => { seletorForn.innerHTML += `<option value="${f.id}">${f.razao_social}</option>`; }); }
        
        const seletorAfil = document.getElementById('vendAfiliadoId');
        if (seletorAfil) { seletorAfil.innerHTML = '<option value="">Operação Direta da Matriz Central</option>'; cacheAfiliados.forEach(a => { seletorAfil.innerHTML += `<option value="${a.id}">${a.nome} (${a.cnpj})</option>`; }); }

        const tabProd = document.getElementById('tabelaListaProdutos');
        if (tabProd) {
            tabProd.innerHTML = '';
            cacheProdutos.forEach(p => { tabProd.innerHTML += `<tr><td><strong>${p.sku}</strong><br><span style="font-size:12px;">${p.nome}</span></td><td style="color:#10b981; font-weight:600;">R$ ${p.preco_venda.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td><td><span class="badge" style="background:#f1f5f9; color:#0f172a;">${p.estoque_atual} un</span></td><td style="text-align: right;"><button type="button" class="btn-icone" style="background-color: #3b82f6;" onclick="prepararEdicaoBase('produtos', ${p.id})"><i class="ph ph-pencil"></i></button> <button type="button" class="btn-icone" style="background-color: #ef4444;" onclick="deletarEntidadeBase('produtos', ${p.id})"><i class="ph ph-trash"></i></button></td></tr>`; });
        }

        const tabForn = document.getElementById('tabelaListaFornecedores');
        if (tabForn) {
            tabForn.innerHTML = '';
            cacheFornecedores.forEach(f => { tabForn.innerHTML += `<tr><td><strong>${f.razao_social}</strong></td><td>${f.cnpj}</td><td style="text-align: right;"><button type="button" class="btn-icone" style="background-color: #3b82f6;" onclick="prepararEdicaoBase('fornecedores', ${f.id})"><i class="ph ph-pencil"></i></button> <button type="button" class="btn-icone" style="background-color: #ef4444;" onclick="deletarEntidadeBase('fornecedores', ${f.id})"><i class="ph ph-trash"></i></button></td></tr>`; });
        }

        const tabTransp = document.getElementById('tabelaListaTransportadoras');
        if (tabTransp) {
            tabTransp.innerHTML = '';
            cacheTransportadoras.forEach(t => { tabTransp.innerHTML += `<tr><td><strong>${t.nome}</strong></td><td style="color:#2563eb; font-weight:600;">R$ ${t.taxa_base_frete.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td><td style="text-align: right;"><button type="button" class="btn-icone" style="background-color: #3b82f6;" onclick="prepararEdicaoBase('transportadoras', ${t.id})"><i class="ph ph-pencil"></i></button> <button type="button" class="btn-icone" style="background-color: #ef4444;" onclick="deletarEntidadeBase('transportadoras', ${t.id})"><i class="ph ph-trash"></i></button></td></tr>`; });
        }

        const tabAfil = document.getElementById('tabelaListaAfiliados');
        if (tabAfil) {
            tabAfil.innerHTML = '';
            cacheAfiliados.forEach(a => { tabAfil.innerHTML += `<tr><td><strong>${a.nome}</strong><br><span style="font-size:11px;">CNPJ: ${a.cnpj}</span></td><td>${a.cidade} - ${a.pais}</td><td style="font-weight:700; color:#8b5cf6;">${(a.taxa_comissao * 100).toFixed(1)}%</td><td style="text-align: right;"><button type="button" class="btn-icone" style="background-color: #3b82f6;" onclick="prepararEdicaoBase('afiliados', ${a.id})"><i class="ph ph-pencil"></i></button> <button type="button" class="btn-icone" style="background-color: #ef4444;" onclick="deletarEntidadeBase('afiliados', ${a.id})"><i class="ph ph-trash"></i></button></td></tr>`; });
        }

        const tabVend = document.getElementById('tabelaListaVendedores');
        if (tabVend) {
            tabVend.innerHTML = '';
            cacheFuncionarios.forEach(f => {
                const afil = cacheAfiliados.find(a => a.id === f.afiliado_id);
                const nomeAfil = afil ? afil.nome : "Matriz Central";
                tabVend.innerHTML += `<tr><td><strong>${f.nome}</strong><br><span style="font-size:11px;">${f.cargo}</span></td><td><span class="badge" style="background:#e0e7ff; color:#4f46e5;">${nomeAfil}</span></td><td style="color:#10b981;">R$ ${f.salario_base.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td><td style="text-align: right;"><button type="button" class="btn-icone" style="background-color: #3b82f6;" onclick="prepararEdicaoBase('funcionarios', ${f.id})"><i class="ph ph-pencil"></i></button> <button type="button" class="btn-icone" style="background-color: #ef4444;" onclick="deletarEntidadeBase('funcionarios', ${f.id})"><i class="ph ph-trash"></i></button></td></tr>`;
            });
        }

        const abaSalva = localStorage.getItem('proversatil_sub_aba') || 'sub-matriz';
        alternarSubAbaCadastro(abaSalva);

    } catch (error) {}
}

function mascararDinheiroFront(valor) {
    let v = valor.toFixed(2).replace(".", ",");
    v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
    return "R$ " + v;
}

function prepararEdicaoBase(endpoint, id) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    modoEdicao[endpoint] = id;
    
    if (endpoint === 'produtos') {
        const item = cacheProdutos.find(x => x.id === id);
        document.getElementById('prodSku').value = item.sku; document.getElementById('prodNome').value = item.nome;
        document.getElementById('prodPrecoCusto').value = mascararDinheiroFront(item.preco_custo); document.getElementById('prodPrecoVenda').value = mascararDinheiroFront(item.preco_venda);
        document.getElementById('prodEstoque').value = item.estoque_atual; document.getElementById('prodFornecedorId').value = item.fornecedor_id;
        alternarSubAbaCadastro('sub-produtos');
        document.getElementById('tituloFormProduto').innerHTML = '<i class="ph ph-pencil"></i> Editando Produto';
        document.getElementById('btnSubmitProduto').innerHTML = '<i class="ph ph-arrows-clockwise"></i> Atualizar Produto';
        document.querySelector("#formProduto .btn-cancelar-edicao").style.display = 'block';
    } 
    else if (endpoint === 'fornecedores') {
        const item = cacheFornecedores.find(x => x.id === id);
        document.getElementById('fornCnpj').value = item.cnpj; document.getElementById('fornRazaoSocial').value = item.razao_social; document.getElementById('fornContato').value = item.contato;
        alternarSubAbaCadastro('sub-fornecedores');
        document.getElementById('tituloFormFornecedor').innerHTML = '<i class="ph ph-pencil"></i> Editando Fornecedor';
        document.getElementById('btnSubmitFornecedor').innerHTML = '<i class="ph ph-arrows-clockwise"></i> Atualizar Fornecedor';
        document.querySelector("#formFornecedor .btn-cancelar-edicao").style.display = 'block';
    }
    else if (endpoint === 'transportadoras') {
        const item = cacheTransportadoras.find(x => x.id === id);
        document.getElementById('transpCnpj').value = item.cnpj; document.getElementById('transpNome').value = item.nome; document.getElementById('transpFreteBase').value = mascararDinheiroFront(item.taxa_base_frete);
        alternarSubAbaCadastro('sub-transportadoras');
        document.getElementById('tituloFormTransportadora').innerHTML = '<i class="ph ph-pencil"></i> Editando Transportadora';
        document.getElementById('btnSubmitTransportadora').innerHTML = '<i class="ph ph-arrows-clockwise"></i> Atualizar Transportadora';
        document.querySelector("#formTransportadora .btn-cancelar-edicao").style.display = 'block';
    }
    else if (endpoint === 'afiliados') {
        const item = cacheAfiliados.find(x => x.id === id);
        document.getElementById('afilCnpj').value = item.cnpj; document.getElementById('afilNome').value = item.nome;
        document.getElementById('afilPais').value = item.pais; document.getElementById('afilCidade').value = item.cidade;
        document.getElementById('afilCodigo').value = item.codigo_rastreio; document.getElementById('afilComissao').value = (item.taxa_comissao * 100).toFixed(1);
        alternarSubAbaCadastro('sub-afiliados');
        document.getElementById('tituloFormAfiliado').innerHTML = '<i class="ph ph-pencil"></i> Editando Empresa Filiada';
        document.getElementById('btnSubmitAfiliado').innerHTML = '<i class="ph ph-arrows-clockwise"></i> Atualizar Empresa Filiada';
        document.querySelector("#formAfiliado .btn-cancelar-edicao").style.display = 'block';
    }
    else if (endpoint === 'funcionarios') {
        const item = cacheFuncionarios.find(x => x.id === id);
        document.getElementById('vendNome').value = item.nome; document.getElementById('vendAfiliadoId').value = item.afiliado_id || "";
        document.getElementById('vendCargo').value = item.cargo; document.getElementById('vendSalario').value = mascararDinheiroFront(item.salario_base);
        alternarSubAbaCadastro('sub-vendedores');
        document.getElementById('tituloFormVendedor').innerHTML = '<i class="ph ph-pencil"></i> Editando Vendedor';
        document.getElementById('btnSubmitVendedor').innerHTML = '<i class="ph ph-arrows-clockwise"></i> Atualizar Colaborador';
        document.querySelector("#formVendedor .btn-cancelar-edicao").style.display = 'block';
    }
    else if (endpoint === 'clientes') {
        const item = cacheClientesCRM.find(x => x.id === id);
        document.getElementById('cliNome').value = item.nome; document.getElementById('cliDocumento').value = item.documento; document.getElementById('cliEndereco').value = item.endereco;
        if(document.getElementById('cliTelefone')) document.getElementById('cliTelefone').value = item.telefone || "";
        document.getElementById('tituloFormCliente').innerHTML = '<i class="ph ph-pencil"></i> Editando Cliente';
        document.getElementById('btnSubmitCliente').innerHTML = '<i class="ph ph-arrows-clockwise"></i> Atualizar Cliente';
        document.querySelector("#formCliente .btn-cancelar-edicao").style.display = 'block';
    }
}

function cancelarEdicao(endpoint, formId, btnSubmitId, originalText) {
    modoEdicao[endpoint] = null;
    document.getElementById(formId).reset();
    document.getElementById(btnSubmitId).innerHTML = originalText;
    document.querySelector(`#${formId} .btn-cancelar-edicao`).style.display = 'none';
    
    if(endpoint === 'produtos') document.getElementById('tituloFormProduto').innerHTML = '<i class="ph ph-package"></i> Novo Produto Comercial';
    else if(endpoint === 'fornecedores') document.getElementById('tituloFormFornecedor').innerHTML = '<i class="ph ph-factory"></i> Cadastrar Fornecedor Industrial';
    else if(endpoint === 'transportadoras') document.getElementById('tituloFormTransportadora').innerHTML = '<i class="ph ph-truck"></i> Configurar Operador Logístico';
    else if(endpoint === 'afiliados') document.getElementById('tituloFormAfiliado').innerHTML = '<i class="ph ph-buildings"></i> Nova Empresa Filiada (B2B)';
    else if(endpoint === 'funcionarios') document.getElementById('tituloFormVendedor').innerHTML = '<i class="ph ph-identification-badge"></i> Cadastrar Novo Vendedor';
    else if(endpoint === 'clientes') document.getElementById('tituloFormCliente').innerHTML = '<i class="ph ph-user-plus"></i> Cadastrar Novo Cliente';
}

function inicializarEventosFormulariosCadastro() {
    if (listenersInjetados) return; 

    const formMatriz = document.getElementById('formMatriz');
    if (formMatriz) {
        formMatriz.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = { nome: document.getElementById('matrizNome').value.trim(), razao_social: document.getElementById('matrizRazao').value.trim(), cnpj: document.getElementById('matrizCnpj').value.trim(), endereco: document.getElementById('matrizEndereco').value.trim(), telefone: document.getElementById('matrizTelefone').value.trim() };
            try {
                const response = await apiFetch(`${API_BASE_URL}/matriz/`, { method: "PUT", body: JSON.stringify(payload) });
                if (response.ok) { Swal.fire({ title: 'Matriz Atualizada!', text: 'Seus dados fiscais foram salvos.', icon: 'success', timer: 2000, showConfirmButton: false }); carregarCadastrosGerais(); }
            } catch (err) {}
        });
    }

    const formForma = document.getElementById('formFormaPagamento');
    if (formForma) {
        formForma.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = { nome: document.getElementById('formaPagNome').value.trim() };
            await enviarDadosEntidade('formas_pagamento', payload, 'formFormaPagamento');
        });
    }

    const formCond = document.getElementById('formCondicaoPagamento');
    if (formCond) {
        formCond.addEventListener('submit', async (e) => {
            e.preventDefault();
            if(parcelasCondicaoTemp.length === 0) {
                Swal.fire('Erro', 'Adicione pelo menos uma parcela.', 'error'); return;
            }
            let soma = 0; parcelasCondicaoTemp.forEach(p => soma += p.percentual);
            if(soma < 99.9 || soma > 100.1) {
                Swal.fire('Erro', 'A soma das parcelas deve ser 100%.', 'error'); return;
            }
            
            const payload = {
                descricao: document.getElementById('condDescricao').value.trim(),
                forma_pagamento_id: parseInt(document.getElementById('condFormaId').value),
                parcelas: parcelasCondicaoTemp
            };
            
            try {
                const res = await apiFetch(`${API_BASE_URL}/condicoes_pagamento/`, { method: "POST", body: JSON.stringify(payload) });
                if (res.ok) {
                    Swal.fire({ title: 'Sucesso!', text: 'Condição de Pagamento salva.', icon: 'success', timer: 1500, showConfirmButton: false });
                    document.getElementById('formCondicaoPagamento').reset();
                    parcelasCondicaoTemp = []; renderizarTabelaParcelas(); carregarCadastrosGerais();
                } else { Swal.fire('Operação Rejeitada', 'Verifique os dados informados.', 'warning'); }
            } catch (err) {}
        });
    }

    const formCliente = document.getElementById('formCliente');
    if (formCliente) {
        formCliente.addEventListener('submit', async (e) => {
            e.preventDefault();
            const telField = document.getElementById('cliTelefone');
            const payload = { 
                nome: document.getElementById('cliNome').value.trim(), 
                documento: document.getElementById('cliDocumento').value.trim(), 
                endereco: document.getElementById('cliEndereco').value.trim(), 
                telefone: telField ? telField.value.trim() : "" 
            };
            await enviarDadosEntidade('clientes', payload, 'formCliente');
        });
    }

    document.getElementById('formProduto').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            sku: document.getElementById('prodSku').value.trim(), nome: document.getElementById('prodNome').value.trim(),
            preco_custo: converterParaNumero(document.getElementById('prodPrecoCusto').value), preco_venda: converterParaNumero(document.getElementById('prodPrecoVenda').value),
            estoque_atual: parseInt(document.getElementById('prodEstoque').value) || 0, fornecedor_id: parseInt(document.getElementById('prodFornecedorId').value)
        };
        await enviarDadosEntidade('produtos', payload, 'formProduto');
    });

    document.getElementById('formFornecedor').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = { razao_social: document.getElementById('fornRazaoSocial').value.trim(), cnpj: document.getElementById('fornCnpj').value.trim(), contato: document.getElementById('fornContato').value.trim() };
        await enviarDadosEntidade('fornecedores', payload, 'formFornecedor');
    });

    document.getElementById('formTransportadora').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = { nome: document.getElementById('transpNome').value.trim(), cnpj: document.getElementById('transpCnpj').value.trim(), taxa_base_frete: converterParaNumero(document.getElementById('transpFreteBase').value) };
        await enviarDadosEntidade('transportadoras', payload, 'formTransportadora');
    });

    document.getElementById('formAfiliado').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            cnpj: document.getElementById('afilCnpj').value.trim(), nome: document.getElementById('afilNome').value.trim(),
            pais: document.getElementById('afilPais').value.trim(), cidade: document.getElementById('afilCidade').value.trim(),
            codigo_rastreio: document.getElementById('afilCodigo').value.trim().toUpperCase(),
            taxa_comissao: (parseFloat(document.getElementById('afilComissao').value) || 0) / 100 
        };
        await enviarDadosEntidade('afiliados', payload, 'formAfiliado');
    });

    document.getElementById('formVendedor').addEventListener('submit', async (e) => {
        e.preventDefault();
        const afilId = document.getElementById('vendAfiliadoId').value;
        const payload = {
            nome: document.getElementById('vendNome').value.trim(), cargo: document.getElementById('vendCargo').value.trim(),
            salario_base: converterParaNumero(document.getElementById('vendSalario').value),
            afiliado_id: afilId ? parseInt(afilId) : null
        };
        await enviarDadosEntidade('funcionarios', payload, 'formVendedor');
    });

    document.getElementById('formNovaNFe').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (carrinhoNFe.length === 0) return;
        
        const emissorVal = document.getElementById('nfeFilialId').value;
        const isMatriz = emissorVal.startsWith('MATRIZ_');
        const emissorId = parseInt(emissorVal.split('_')[1]);
        
        const dataVendaInput = document.getElementById('nfeDataEmissao').value;
        const dataVendaFormatada = dataVendaInput ? new Date(dataVendaInput).toISOString() : null;
        
        const payload = {
            numero_nf: document.getElementById('nfeNumero').value.trim(), 
            data_emissao: dataVendaFormatada,
            filial_id: isMatriz ? emissorId : null,
            emissor_afiliado_id: !isMatriz ? emissorId : null,
            cliente_id: parseInt(document.getElementById('nfeClienteId').value),
            vendedor_id: parseInt(document.getElementById('nfeVendedorId').value), 
            transportadora_id: parseInt(document.getElementById('nfeTransportadoraId').value),
            afiliado_id: document.getElementById('nfeAfiliadoId').value ? parseInt(document.getElementById('nfeAfiliadoId').value) : null,
            condicao_pagamento_id: parseInt(document.getElementById('nfeCondicaoPagamentoId').value),
            valor_frete: converterParaNumero(document.getElementById('nfeFrete').value),
            itens: carrinhoNFe.map(item => ({ produto_id: item.produto_id, quantidade: item.quantidade }))
        };

        try {
            const res = await apiFetch(`${API_BASE_URL}/notas_fiscais/`, { method: "POST", body: JSON.stringify(payload) });
            if(res.ok) {
                Swal.fire('Nota Faturada!', 'Transação armazenada.', 'success'); document.getElementById('formNovaNFe').reset(); prepararPainelVendas();
            } else { const err = await res.json(); Swal.fire('Rejeitado', err.detail || 'Verifique inconsistências.', 'error'); }
        } catch(err) {}
    });

    listenersInjetados = true;
}

async function enviarDadosEntidade(endpoint, payload, idFormulario) {
    const idEdicao = modoEdicao[endpoint];
    const url = idEdicao ? `${API_BASE_URL}/${endpoint}/${idEdicao}` : `${API_BASE_URL}/${endpoint}/`;
    const method = idEdicao ? "PUT" : "POST";

    try {
        const response = await apiFetch(url, { method: method, body: JSON.stringify(payload) });
        if (response.ok) {
            Swal.fire({ title: 'Sucesso!', text: idEdicao ? 'Registro atualizado.' : 'Registro salvo.', icon: 'success', timer: 1500, showConfirmButton: false });
            if(document.querySelector(`#${idFormulario} .btn-cancelar-edicao`)) { document.querySelector(`#${idFormulario} .btn-cancelar-edicao`).click(); } 
            else { document.getElementById(idFormulario).reset(); }

            if(endpoint === 'clientes') carregarListaClientes();
            else carregarCadastrosGerais(); 
        } else {
            const erroData = await response.json();
            Swal.fire('Operação Rejeitada', erroData.detail || 'Verifique os dados.', 'warning');
        }
    } catch (err) {}
}

function deletarEntidadeBase(endpoint, id) {
    Swal.fire({
        title: 'Remover Registro?', text: "Essa ação impacta tabelas com amarrações históricas.", icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Confirmar Exclusão'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const response = await apiFetch(`${API_BASE_URL}/${endpoint}/${id}`, { method: "DELETE" });
                if(response.ok) { 
                    if(endpoint === 'clientes') carregarListaClientes();
                    else carregarCadastrosGerais(); 
                } 
                else { Swal.fire('Bloqueado', 'O item está amarrado a outra tabela.', 'error'); }
            } catch(e) {}
        }
    });
}

function filtrarVendedoresPorFilial() {
    const emissorVal = document.getElementById('nfeFilialId').value;
    const selVend = document.getElementById('nfeVendedorId');
    selVend.innerHTML = '<option disabled selected value="">Selecione o Vendedor...</option>';

    if (!emissorVal) return;

    const isMatriz = emissorVal.startsWith('MATRIZ_');
    const emissorId = parseInt(emissorVal.split('_')[1]);

    let vendedoresFiltrados = [];
    if (isMatriz) {
        vendedoresFiltrados = cacheFuncionarios.filter(f => !f.afiliado_id);
    } else {
        vendedoresFiltrados = cacheFuncionarios.filter(f => f.afiliado_id === emissorId);
    }

    if(vendedoresFiltrados.length === 0) {
        selVend.innerHTML += `<option disabled value="">Nenhum vendedor nesta unidade</option>`;
    } else {
        vendedoresFiltrados.forEach(f => {
            selVend.innerHTML += `<option value="${f.id}">${f.nome} - ${f.cargo}</option>`;
        });
    }
}

async function prepararPainelVendas() {
    Swal.fire({ title: 'Carregando PDV...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    try {
        const [resProd, resTransp, resAfil, resCli, resFunc, resFilial, resConds] = await Promise.all([
            apiFetch(`${API_BASE_URL}/produtos/?t=${new Date().getTime()}`), apiFetch(`${API_BASE_URL}/transportadoras/?t=${new Date().getTime()}`), apiFetch(`${API_BASE_URL}/afiliados/?t=${new Date().getTime()}`),
            apiFetch(`${API_BASE_URL}/clientes/?t=${new Date().getTime()}`), apiFetch(`${API_BASE_URL}/funcionarios/?t=${new Date().getTime()}`), apiFetch(`${API_BASE_URL}/filiais/?t=${new Date().getTime()}`),
            apiFetch(`${API_BASE_URL}/condicoes_pagamento/?t=${new Date().getTime()}`)
        ]);

        catalogoProdutosCache = await resProd.json(); transportadorasCache = await resTransp.json();
        const afiliados = await resAfil.json(); const clientes = await resCli.json(); 
        cacheFuncionarios = await resFunc.json(); 
        const filiais = await resFilial.json(); const conds = await resConds.json();

        Swal.close();

        const agora = new Date();
        agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset());
        document.getElementById('nfeDataEmissao').value = agora.toISOString().slice(0, 16);

        const selFilial = document.getElementById('nfeFilialId');
        selFilial.innerHTML = '<option disabled selected value="">Selecione a Empresa Emissora...</option>';
        filiais.forEach(f => { selFilial.innerHTML += `<option value="MATRIZ_${f.id}">Matriz: ${f.nome} (${f.cnpj})</option>`; });
        afiliados.forEach(a => { selFilial.innerHTML += `<option value="FILIADA_${a.id}">Filiada: ${a.nome} (${a.cnpj})</option>`; });

        const selVend = document.getElementById('nfeVendedorId');
        selVend.innerHTML = '<option disabled selected value="">Selecione a Filial Emissora primeiro...</option>';

        const selProd = document.getElementById('nfeProdutoSelect');
        selProd.innerHTML = '<option disabled selected value="">Escolha um produto...</option>';
        catalogoProdutosCache.forEach(p => { if(p.estoque_atual > 0) selProd.innerHTML += `<option value="${p.id}">${p.sku} - ${p.nome} (${p.estoque_atual} un)</option>`; });

        const selTransp = document.getElementById('nfeTransportadoraId');
        selTransp.innerHTML = '<option disabled selected value="">Selecione a transportadora...</option>';
        transportadorasCache.forEach(t => { selTransp.innerHTML += `<option value="${t.id}">${t.nome}</option>`; });

        const selCond = document.getElementById('nfeCondicaoPagamentoId');
        selCond.innerHTML = '<option disabled selected value="">Selecione a Condição de Pagamento...</option>';
        conds.forEach(c => { selCond.innerHTML += `<option value="${c.id}">${c.descricao}</option>`; });

        const selAfil = document.getElementById('nfeAfiliadoId');
        selAfil.innerHTML = '<option value="">Venda Direta da Matriz</option>';
        afiliados.forEach(a => { selAfil.innerHTML += `<option value="${a.id}">${a.nome} (${a.cnpj})</option>`; });

        const selCli = document.getElementById('nfeClienteId');
        selCli.innerHTML = '<option disabled selected value="">Selecione o Cliente...</option>';
        clientes.forEach(c => { selCli.innerHTML += `<option value="${c.id}">${c.nome}</option>`; });

        carrinhoNFe = [];
        document.getElementById('nfeFrete').value = "R$ 0,00";
        renderizarCarrinho();
    } catch(e) { Swal.close(); }
}

function atualizarFreteBase() {
    const idTransp = parseInt(document.getElementById('nfeTransportadoraId').value);
    const transp = transportadorasCache.find(t => t.id === idTransp);
    if (transp) { document.getElementById('nfeFrete').value = "R$ " + transp.taxa_base_frete.toFixed(2).replace(".", ","); calcularTotaisCarrinho(); }
}

function adicionarItemCarrinho() {
    const selectProd = document.getElementById('nfeProdutoSelect'); const inputQtd = document.getElementById('nfeProdutoQtd');
    const prodId = parseInt(selectProd.value); const qtd = parseInt(inputQtd.value);

    if (!prodId || qtd <= 0) return;
    const produtoRef = catalogoProdutosCache.find(p => p.id === prodId);

    if (qtd > produtoRef.estoque_atual) { Swal.fire('Estoque Insuficiente', 'A quantidade solicitada supera a reserva atual.', 'error'); return; }

    const idx = carrinhoNFe.findIndex(item => item.produto_id === prodId);
    if (idx >= 0) {
        carrinhoNFe[idx].quantidade += qtd; carrinhoNFe[idx].subtotal = carrinhoNFe[idx].quantidade * produtoRef.preco_venda;
    } else {
        carrinhoNFe.push({ produto_id: produtoRef.id, sku: produtoRef.sku, nome: produtoRef.nome, preco_unitario: produtoRef.preco_venda, quantidade: qtd, subtotal: qtd * produtoRef.preco_venda });
    }
    renderizarCarrinho();
}

function removerItemCarrinho(index) { carrinhoNFe.splice(index, 1); renderizarCarrinho(); }

function renderizarCarrinho() {
    const tbody = document.getElementById('tabelaCarrinhoItens');
    tbody.innerHTML = '';
    if (carrinhoNFe.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding:30px;">O carrinho está vazio.</td></tr>`;
    } else {
        carrinhoNFe.forEach((item, index) => {
            tbody.innerHTML += `<tr><td><strong>${item.sku}</strong><br><span style="font-size:12px;">${item.nome}</span></td><td>${item.quantidade} un</td><td>R$ ${item.preco_unitario.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td style="font-weight:700; color:#10b981;">R$ ${item.subtotal.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td style="text-align: right;"><button type="button" class="btn-remover-lista" onclick="removerItemCarrinho(${index})"><i class="ph ph-trash"></i></button></td></tr>`;
        });
    }
    calcularTotaisCarrinho();
}

function calcularTotaisCarrinho() {
    const subtotal = carrinhoNFe.reduce((acc, item) => acc + item.subtotal, 0);
    const frete = converterParaNumero(document.getElementById('nfeFrete').value);
    const totalGeral = subtotal + frete;
    document.getElementById('resumoSubtotal').innerText = `R$ ${subtotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    document.getElementById('resumoFrete').innerText = `R$ ${frete.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    document.getElementById('resumoTotalGeral').innerText = `R$ ${totalGeral.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
}

async function carregarHistoricoNotas() {
    try {
        const [resNFe, resCli, resFunc, resTransp, resFilial, resAfil] = await Promise.all([ 
            apiFetch(`${API_BASE_URL}/notas_fiscais/?t=${new Date().getTime()}`), 
            apiFetch(`${API_BASE_URL}/clientes/?t=${new Date().getTime()}`),
            apiFetch(`${API_BASE_URL}/funcionarios/?t=${new Date().getTime()}`),
            apiFetch(`${API_BASE_URL}/transportadoras/?t=${new Date().getTime()}`),
            apiFetch(`${API_BASE_URL}/filiais/?t=${new Date().getTime()}`),
            apiFetch(`${API_BASE_URL}/afiliados/?t=${new Date().getTime()}`)
        ]);
        cacheNotasFiscais = await resNFe.json(); const clientes = await resCli.json();
        
        window.cacheClientes = clientes;
        window.cacheFuncionarios = await resFunc.json();
        window.cacheTransportadoras = await resTransp.json();
        window.cacheFiliais = await resFilial.json();
        window.cacheAfiliados = await resAfil.json();
        
        const corpo = document.getElementById('corpoTabelaNFe');
        if (!corpo) return;
        corpo.innerHTML = '';

        cacheNotasFiscais.sort((a, b) => {
            return a.numero_nf.localeCompare(b.numero_nf, undefined, { numeric: true, sensitivity: 'base' });
        });

        cacheNotasFiscais.forEach(nf => {
            const cli = clientes.find(c => c.id === nf.cliente_id);
            const status = nf.status_logistico;
            corpo.innerHTML += `<tr><td><strong>${nf.numero_nf}</strong></td><td>${new Date(nf.data_emissao).toLocaleDateString('pt-BR')}</td><td>${cli ? cli.nome : 'Desconhecido'}</td><td><span class="badge">${status}</span></td><td><div class="acoes-container"><button class="btn-icone" style="background-color:#64748b;" onclick="abrirModalNFe(${nf.id})"><i class="ph ph-eye"></i></button><button class="btn-icone" style="background-color:#3b82f6;" onclick="avancarStatusLogistico(${nf.id}, '${status}')"><i class="ph ph-fast-forward"></i></button><button class="btn-icone" style="background-color:#0f172a;" onclick="window.open('${API_BASE_URL}/notas_fiscais/${nf.id}/pdf', '_blank')"><i class="ph ph-printer"></i></button></div></td></tr>`;
        });
    } catch(e) {}
}

async function avancarStatusLogistico(idNFe, statusAtual) {
    if (statusAtual === "Entregue") return;
    const fluxo = { "Aprovada": "Em Separação", "Em Separação": "Em Trânsito", "Em Trânsito": "Entregue" };
    const res = await apiFetch(`${API_BASE_URL}/notas_fiscais/${idNFe}/status`, { method: "PUT", body: JSON.stringify({ novo_status: fluxo[statusAtual] }) });
    if(res.ok) carregarHistoricoNotas();
}

function abrirModalNFe(idNFe) {
    const nf = cacheNotasFiscais.find(n => n.id === idNFe);
    if (!nf) return;

    const cli = window.cacheClientes ? window.cacheClientes.find(c => c.id === nf.cliente_id) : null;
    const vend = window.cacheFuncionarios ? window.cacheFuncionarios.find(v => v.id === nf.vendedor_id) : null;
    const transp = window.cacheTransportadoras ? window.cacheTransportadoras.find(t => t.id === nf.transportadora_id) : null;
    const filial = window.cacheFiliais ? window.cacheFiliais.find(f => f.id === nf.filial_id) : null;
    const emissorFiliada = window.cacheAfiliados ? window.cacheAfiliados.find(a => a.id === nf.emissor_afiliado_id) : null;

    let emissorTxt = "Matriz Central";
    if (emissorFiliada) emissorTxt = `Filiada: ${emissorFiliada.nome}`;
    else if (filial) emissorTxt = `Matriz: ${filial.nome}`;

    document.getElementById('conteudoNFeDetalhes').innerHTML = `
        <div class="detalhe-item"><strong>Documento NF:</strong> ${nf.numero_nf}</div>
        <div class="detalhe-item"><strong>Data Emissão:</strong> ${new Date(nf.data_emissao).toLocaleString('pt-BR')}</div>
        <div class="detalhe-item"><strong>Status:</strong> ${nf.status_logistico}</div>
        <div class="detalhe-item"><strong>Empresa Emissora:</strong> ${emissorTxt}</div>
        <div class="detalhe-item"><strong>Cliente:</strong> ${cli ? cli.nome : 'N/A'}</div>
        <div class="detalhe-item"><strong>Vendedor:</strong> ${vend ? vend.nome : 'N/A'}</div>
        <div class="detalhe-item"><strong>Transportadora:</strong> ${transp ? transp.nome : 'N/A'}</div>
        <div class="detalhe-item"><strong>Valor do Frete:</strong> R$ ${nf.valor_frete.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
        <div class="detalhe-item" style="border-left-color: #10b981; background: #10b98110;">
            <strong>Faturamento Total:</strong> R$ ${nf.valor_total.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
        </div>
    `;

    const tabela = document.getElementById('tabelaItensModal');
    tabela.innerHTML = '';
    nf.itens.forEach(it => { 
        tabela.innerHTML += `<tr><td>ID Produto: ${it.produto_id}</td><td style="text-align:center;">${it.quantidade}x</td><td style="text-align:right;">R$ ${it.preco_unitario.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td style="text-align:right;">R$ ${it.subtotal.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td></tr>`; 
    });
    document.getElementById('btnImprimirNFeModal').onclick = () => window.open(`${API_BASE_URL}/notas_fiscais/${nf.id}/pdf`, '_blank');
    document.getElementById('modalNFeDetalhes').style.display = 'flex';
}

function fecharModal() { document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); }