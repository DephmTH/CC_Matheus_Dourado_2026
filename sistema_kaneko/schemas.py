from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class LoginData(BaseModel):
    usuario: str
    senha: str

class FilialBase(BaseModel):
    nome: str
    razao_social: str
    cnpj: str
    endereco: str
    telefone: str

class FilialResponse(FilialBase):
    id: int
    class Config:
        from_attributes = True

class FormaPagamentoCreate(BaseModel):
    nome: str

class FormaPagamentoResponse(FormaPagamentoCreate):
    id: int
    class Config:
        from_attributes = True

class ParcelaCondicaoCreate(BaseModel):
    numero_parcela: int
    dias_vencimento: int
    percentual: float

class ParcelaCondicaoResponse(ParcelaCondicaoCreate):
    id: int
    class Config:
        from_attributes = True

class CondicaoPagamentoCreate(BaseModel):
    descricao: str
    forma_pagamento_id: int
    parcelas: List[ParcelaCondicaoCreate] = Field(min_length=1)

class CondicaoPagamentoResponse(BaseModel):
    id: int
    descricao: str
    forma_pagamento_id: int
    parcelas: List[ParcelaCondicaoResponse] = []
    class Config:
        from_attributes = True

class FornecedorCreate(BaseModel):
    razao_social: str
    cnpj: str
    contato: str

class FornecedorResponse(FornecedorCreate):
    id: int
    class Config:
        from_attributes = True

class AfiliadoCreate(BaseModel):
    cnpj: str
    nome: str
    pais: str
    cidade: str
    codigo_rastreio: str
    taxa_comissao: float

class AfiliadoResponse(AfiliadoCreate):
    id: int
    class Config:
        from_attributes = True

class TransportadoraCreate(BaseModel):
    nome: str
    cnpj: str
    taxa_base_frete: float

class TransportadoraResponse(TransportadoraCreate):
    id: int
    class Config:
        from_attributes = True

class ClienteCreate(BaseModel):
    nome: str
    documento: str
    endereco: str
    telefone: Optional[str] = None

class ClienteResponse(ClienteCreate):
    id: int
    class Config:
        from_attributes = True

class FuncionarioCreate(BaseModel):
    nome: str
    cargo: str
    salario_base: float
    filial_id: Optional[int] = None
    afiliado_id: Optional[int] = None

class FuncionarioResponse(FuncionarioCreate):
    id: int
    ativo: bool
    class Config:
        from_attributes = True

class ProdutoCreate(BaseModel):
    sku: str
    nome: str
    preco_custo: float
    preco_venda: float
    estoque_atual: int
    fornecedor_id: int

class ProdutoResponse(ProdutoCreate):
    id: int
    class Config:
        from_attributes = True

class NotaFiscalItemCreate(BaseModel):
    produto_id: int
    quantidade: int

class NotaFiscalItemResponse(BaseModel):
    id: int
    produto_id: int
    quantidade: int
    preco_unitario: float
    subtotal: float
    class Config:
        from_attributes = True

class NotaFiscalCreate(BaseModel):
    numero_nf: str
    data_emissao: Optional[datetime] = None
    filial_id: Optional[int] = None
    emissor_afiliado_id: Optional[int] = None
    cliente_id: int
    vendedor_id: int
    transportadora_id: int
    afiliado_id: Optional[int] = None
    condicao_pagamento_id: int
    valor_frete: float = 0.0
    itens: List[NotaFiscalItemCreate]

class NotaFiscalResponse(BaseModel):
    id: int
    numero_nf: str
    data_emissao: datetime
    status_logistico: str
    valor_produtos: float
    valor_frete: float
    valor_total: float
    filial_id: Optional[int]
    emissor_afiliado_id: Optional[int]
    cliente_id: int
    vendedor_id: int
    transportadora_id: int
    afiliado_id: Optional[int]
    condicao_pagamento_id: int
    itens: List[NotaFiscalItemResponse] = []
    class Config:
        from_attributes = True

class LogAcessoResponse(BaseModel):
    id: int
    usuario_tentativa: str
    data_hora: datetime
    status: str
    ip_origem: str
    class Config:
        from_attributes = True