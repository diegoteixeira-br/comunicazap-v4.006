const EVOLUTION_API_URL = "https://evo.belaformaonline.com";
const EVOLUTION_API_KEY = "31174a7e3db03f6f8052a1af809032ec";

interface CreateInstanceResponse {
  instance: {
    instanceName: string;
    status: string;
  };
}

interface QRCodeResponse {
  base64: string;
  code: string;
}

interface InstanceStatusResponse {
  instance: {
    instanceName: string;
    status: string;
  };
}

export const evolutionApi = {
  async createInstance(instanceName: string): Promise<CreateInstanceResponse> {
    const response = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
      }),
    });

    if (!response.ok) {
      throw new Error("Erro ao criar instância");
    }

    return response.json();
  },

  async getQRCode(instanceName: string): Promise<QRCodeResponse> {
    const response = await fetch(
      `${EVOLUTION_API_URL}/instance/connect/${instanceName}`,
      {
        method: "GET",
        headers: {
          "apikey": EVOLUTION_API_KEY,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Erro ao obter QR Code");
    }

    return response.json();
  },

  async getInstanceStatus(instanceName: string): Promise<InstanceStatusResponse> {
    const response = await fetch(
      `${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`,
      {
        method: "GET",
        headers: {
          "apikey": EVOLUTION_API_KEY,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Erro ao verificar status");
    }

    return response.json();
  },

  async deleteInstance(instanceName: string): Promise<void> {
    const response = await fetch(
      `${EVOLUTION_API_URL}/instance/delete/${instanceName}`,
      {
        method: "DELETE",
        headers: {
          "apikey": EVOLUTION_API_KEY,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Erro ao excluir instância");
    }
  },

  async sendMessage(
    instanceName: string,
    number: string,
    text: string
  ): Promise<void> {
    const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number,
        text,
      }),
    });

    if (!response.ok) {
      throw new Error("Erro ao enviar mensagem");
    }
  },
};

export const getInstanceName = (): string => {
  let instanceName = localStorage.getItem("evolutionInstanceName");
  
  if (!instanceName) {
    instanceName = `usuario-${Date.now()}`;
    localStorage.setItem("evolutionInstanceName", instanceName);
  }
  
  return instanceName;
};

export const clearInstanceName = (): void => {
  localStorage.removeItem("evolutionInstanceName");
};
