# Multi-UVTools

🌐 **[Aceder ao Site / Access the Website](https://spm81.github.io/Multi-UVTools/)**
<div align="left">
  <a href="https://www.youtube.com/watch?v=92wWtmem6cM&t=283s">
     <img src="https://img.youtube.com/vi/92wWtmem6cM/hqdefault.jpg" 
          alt="Testing Multi-UVTools" 
          style="width:320px; border-radius:15px;">
  </a>
</div>
---

## 🇵🇹 Português

Ferramenta web para flash de firmware em rádios Quansheng diretamente no browser.

### ✨ Funcionalidades

- **Flash de Firmware** para UV-K5, UV-K6 e UV-5R Plus
- **Flash de Firmware** para UV-K5 V3 e UV-K1
- **Firmwares Stock** da Quansheng incluídos
- **Firmwares Custom** (Matoz, F4HWN, Calypso, Joaquim, Fagci e outros)
- **Leitura/Escrita de EEPROM**
- **Display Mirror** - Espelha o ecrã do rádio em tempo real
- **SMR** - Monitorização de sinal em tempo real
- **Suporte para TK11 e RT890**
- Funciona diretamente no browser via **WebSerial API**
- Não requer instalação de software

### 📻 Rádios Suportados - Quansheng

| Modelo | Flash Firmware | EEPROM |
|--------|----------------|--------|
| UV-K5 | ✅ | ✅ |
| UV-K6 | ✅ | ✅ |
| UV-5R Plus | ✅ | ✅ |
| UV-K5 V3 | ✅ | ✅ |
| UV-K1 | ✅ | ✅ |

### 📻 Rádios Suportados - TK11 / RT890

| Modelo | Flash | SPI | Channels | Settings |
|--------|-------|-----|----------|----------|
| RT890 | ✅ | ✅ | - | - |
| TK11 | ❌ | - | ✅ | ✅ |

> ⚠️ **Nota:** O TK11 não suporta Flash... ainda.

### 🪞 Display Mirror - Compatibilidade

O Display Mirror suporta múltiplos perfis de firmware:

| Perfil | Firmwares Compatíveis | Baudrate |
|--------|----------------------|----------|
| **Joaquim UV-KX** | UV-KX Firmware (todas as versões) | 38400 / 115200 |
| **F4HWN UV-K5v1/v3 UV-K1** | F4HWN Custom Firmware (algumas versões) | 38400 / 115200 |

> 💡 **Nota:** O baudrate é flexível - seleciona o baudrate que corresponde à versão do teu firmware.

### ✉️ SMR - Compatibilidade

O SMR suporta os seguintes firmwares:

| Perfil | Firmwares Compatíveis |
|--------|----------------------|
| **Joaquim UV-KX** | UV-KX Firmware, MCFW V0.33.0C, MCFW V0.34.0C |

### 🚀 Como Usar

1. Acede a **[spm81.github.io/Multi-UVTools](https://spm81.github.io/Multi-UVTools/)**
2. Conecta o rádio em **modo boot** (pressiona PTT enquanto ligas)
3. Seleciona o firmware desejado
4. Clica em Flash!

### 📚 Documentação

- [Wiki Quansheng UV-K5 por Ludwich66](https://github.com/ludwich66/Quansheng_UV-K5_Wiki) - Documentação completa

---

## 🇬🇧 English

Web-based firmware flashing tool for Quansheng radios directly in your browser.

### ✨ Features

- **Firmware Flash** for UV-K5, UV-K6 and UV-5R Plus
- **Firmware Flash** for UV-K5 V3 and UV-K1
- **Stock Firmwares** from Quansheng included
- **Custom Firmwares** (Matoz, F4HWN, Calypso, Joaquim, Fagci and more)
- **EEPROM Read/Write**
- **Display Mirror** - Mirror the radio display in real time
- **SMR** - Short message radio for sending and receiving SMS frames
- **Support for TK11 and RT890**
- Works directly in browser via **WebSerial API**
- No software installation required

### 📻 Supported Radios - Quansheng

| Model | Flash Firmware | EEPROM |
|-------|----------------|--------|
| UV-K5 | ✅ | ✅ |
| UV-K6 | ✅ | ✅ |
| UV-5R Plus | ✅ | ✅ |
| UV-K5 V3 | ✅ | ✅ |
| UV-K1 | ✅ | ✅ |

### 📻 Supported Radios - TK11 / RT890

| Model | Flash | SPI | Channels | Settings |
|-------|-------|-----|----------|----------|
| RT890 | ✅ | ✅ | - | - |
| TK11 | ❌ | - | ✅ | ✅ |

> ⚠️ **Note:** TK11 does not support Flash... yet

### 🪞 Display Mirror - Compatibility

The Display Mirror supports multiple firmware profiles:

| Profile | Compatible Firmwares | Baudrate |
|---------|---------------------|----------|
| **Joaquim UV-KX** | UV-KX Firmware (all versions) | 38400 / 115200 |
| **F4HWN UV-K5v1/v3 UV-K1** | F4HWN Custom Firmware (some versions) | 38400 / 115200 |

> 💡 **Note:** Baudrate is flexible - select the baudrate that matches your firmware version.

### ✉️ SMR - Compatibility

The S-Meter supports the following firmwares:

| Profile | Compatible Firmwares |
|---------|---------------------|
| **Joaquim UV-KX** | UV-KX Firmware, MCFW V0.33.0C, MCFW V0.34.0C |

### 🚀 How to Use

1. Go to **[spm81.github.io/Multi-UVTools](https://spm81.github.io/Multi-UVTools/)**
2. Connect the radio in **boot mode** (hold PTT while turning on)
3. Select the desired firmware
4. Click Flash!

### 📚 Documentation

- [Quansheng UV-K5 Wiki by Ludwich66](https://github.com/ludwich66/Quansheng_UV-K5_Wiki) - Complete documentation

---

## 🤝 Contribuir / Contributing

Este projeto é open source! Podes contribuir com:
- Pull requests
- Reportar bugs
- Sugerir novos firmwares
- Adicionar o teu firmware personalizado

This project is open source! You can contribute by:
- Pull requests
- Reporting bugs
- Suggesting new firmwares
- Add your custom firmware
---

## 📄 Licença / License

Open Source - Feel free to use and contribute!

---

Made with ❤️ by [spm81](https://github.com/spm81) (Matoz)
