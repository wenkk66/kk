#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# llama.cpp 原生编译与端侧离线 GGUF 大模型选型下载器
# 针对 aarch64 (ARM 64位) 开启 NEON SIMD 硬件指令集加速
# ==============================================================================

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_DIR=$(pwd)
mkdir -p "$PROJECT_DIR/models"
mkdir -p "$PROJECT_DIR/logs"

echo -e "${CYAN}====================================================================${NC}"
echo -e "${CYAN}        ⚡ llama.cpp 极速推理引擎编译与模型选型中心            ${NC}"
echo -e "${CYAN}====================================================================${NC}"

# 1. 编译 llama.cpp
if [ -f "$PROJECT_DIR/llama-server" ]; then
    echo -e "${GREEN}✓ 已存在编译好的 llama-server 二进制文件，跳过编译步骤。${NC}"
else
    echo -e "${YELLOW}>>> [1/2] 拉取并编译 llama.cpp (ARM64 NEON 原生优化)...${NC}"
    if [ ! -d "llama.cpp" ]; then
        git clone --depth 1 https://github.com/ggerganov/llama.cpp.git
    fi

    cd llama.cpp
    # 针对手机端 Termux 进行编译配置
    cmake -B build \
      -DCMAKE_BUILD_TYPE=Release \
      -DGGML_NATIVE=OFF \
      -DGGML_CPU_AARCH64=ON \
      -DGGML_OPENBLAS=OFF

    # 获取 CPU 核心数进行并行加速编译
    CPU_CORES=$(grep -c ^processor /proc/cpuinfo 2>/dev/null || echo 4)
    BUILD_JOBS=$(( CPU_CORES > 4 ? 4 : CPU_CORES ))
    echo -e "正在使用 ${BUILD_JOBS} 个线程编译 llama-server，请耐心等待 1~3 分钟..."
    cmake --build build --config Release -j ${BUILD_JOBS} --target llama-server

    cp build/bin/llama-server "$PROJECT_DIR/"
    cd "$PROJECT_DIR"
    echo -e "${GREEN}✓ llama-server 编译成功，已就绪！${NC}"
fi

# 2. 模型选型菜单
echo -e "\n${YELLOW}>>> [2/2] 请选择你想要部署在手机上的离线大模型：${NC}"
echo -e "  ${GREEN}[1] Qwen 2.5 3B Instruct (高质量创作与逻辑强推理)${NC} - 1.93GB，智商显著提升，适合复杂数理推导与专业文案"
echo -e "  ${CYAN}[2] DeepSeek-R1-Distill-Qwen 1.5B (推理强化)${NC} - 1.0GB，强化推理思维链与逻辑运算"
echo -e "  ${CYAN}[3] Qwen 2.5 0.5B Instruct (极致超轻)${NC} - 0.38GB，仅需 400MB 内存，毫秒级响应"
echo -e "  ${CYAN}[4] SmolLM2 1.7B Instruct (HF 开源精选)${NC} - 1.06GB，多语言对话与指令响应流畅"
echo -e "  ${CYAN}[5] Qwen 2.5 1.5B Instruct (轻量平衡)${NC} - 1.0GB，占用 ~1.1GB 内存，发热低"

read -p "请输入序号 [默认回车为 1]: " CHOICE
CHOICE=${CHOICE:-1}

case "$CHOICE" in
    2)
        MODEL_FILE="deepseek-r1-distill-qwen-1.5b-q4_k_m.gguf"
        DOWNLOAD_URL_MS="https://modelscope.cn/models/unsloth/DeepSeek-R1-Distill-Qwen-1.5B-GGUF/resolve/master/DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf"
        DOWNLOAD_URL_HF="https://huggingface.co/unsloth/DeepSeek-R1-Distill-Qwen-1.5B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf"
        ;;
    3)
        MODEL_FILE="qwen2.5-0.5b-instruct-q4_k_m.gguf"
        DOWNLOAD_URL_MS="https://modelscope.cn/models/qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/master/qwen2.5-0.5b-instruct-q4_k_m.gguf"
        DOWNLOAD_URL_HF="https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf"
        ;;
    4)
        MODEL_FILE="smollm2-1.7b-instruct-q4_k_m.gguf"
        DOWNLOAD_URL_MS="https://modelscope.cn/models/HuggingFaceTB/SmolLM2-1.7B-Instruct-GGUF/resolve/master/smollm2-1.7b-instruct-q4_k_m.gguf"
        DOWNLOAD_URL_HF="https://huggingface.co/HuggingFaceTB/SmolLM2-1.7B-Instruct-GGUF/resolve/main/smollm2-1.7b-instruct-q4_k_m.gguf"
        ;;
    5)
        MODEL_FILE="qwen2.5-1.5b-instruct-q4_k_m.gguf"
        DOWNLOAD_URL_MS="https://modelscope.cn/models/qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/master/qwen2.5-1.5b-instruct-q4_k_m.gguf"
        DOWNLOAD_URL_HF="https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf"
        ;;
    *)
        MODEL_FILE="qwen2.5-3b-instruct-q4_k_m.gguf"
        DOWNLOAD_URL_MS="https://modelscope.cn/models/qwen/Qwen2.5-3B-Instruct-GGUF/resolve/master/qwen2.5-3b-instruct-q4_k_m.gguf"
        DOWNLOAD_URL_HF="https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf"
        ;;
esac

DEST_PATH="$PROJECT_DIR/models/$MODEL_FILE"

if [ -f "$DEST_PATH" ]; then
    echo -e "${GREEN}✓ 模型文件已存在: $DEST_PATH，跳过下载。${NC}"
else
    echo -e "${CYAN}正在拉取模型权重文件: $MODEL_FILE ...${NC}"
    echo -e "优先尝试高速魔搭 (ModelScope) 节点，若中断再次运行可断点续传..."
    
    if curl -C - -L --fail -o "$DEST_PATH" "$DOWNLOAD_URL_MS"; then
        echo -e "${GREEN}✓ 从加速镜像下载完成！${NC}"
    else
        echo -e "${YELLOW}魔搭镜像连接超时，正在切换至 HuggingFace 节点...${NC}"
        curl -C - -L -o "$DEST_PATH" "$DOWNLOAD_URL_HF"
    fi
fi

# 更新 .env 中的 MODEL_NAME (检查 ../.env、~/.env 或 .env)
TARGET_ENV=""
for p in "../.env" "$HOME/.env" ".env"; do
    if [ -f "$p" ]; then
        TARGET_ENV="$p"
        break
    fi
done

if [ -n "$TARGET_ENV" ]; then
    if grep -q "^MODEL_NAME=" "$TARGET_ENV" 2>/dev/null; then
        sed -i "s/^MODEL_NAME=.*/MODEL_NAME=\"$MODEL_FILE\"/" "$TARGET_ENV" 2>/dev/null || true
    fi
    echo -e "${GREEN}✓ 已同步配置模型为 $MODEL_FILE (${TARGET_ENV})${NC}"
fi

echo -e "\n${CYAN}====================================================================${NC}"
echo -e "${GREEN}🎉 离线模型与推理引擎配置全部就绪！${NC}"
echo -e "模型路径: ${CYAN}$DEST_PATH${NC}"
echo -e "启动命令: ${CYAN}bash start.sh${NC}"
echo -e "${CYAN}====================================================================${NC}"
