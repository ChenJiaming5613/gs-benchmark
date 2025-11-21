import numpy as np
import matplotlib.pyplot as plt
from scipy import ndimage
from PIL import Image

def compute_radial_profile(image):
    """
    计算图像的径向平均功率谱 (Azimuthal Integration)
    """
    # 1. 转为灰度并归一化
    if len(image.shape) == 3:
        image = np.mean(image, axis=2) # RGB to Grayscale
    image = image / 255.0
    
    # 2. 傅里叶变换 (FFT)
    f = np.fft.fft2(image)
    fshift = np.fft.fftshift(f) # 将零频分量移到中心
    
    # 3. 计算功率谱 (Magnitude Spectrum)
    # 使用幅度 (Magnitude) 或 功率 (Magnitude^2) 均可，这里常用幅度
    magnitude_spectrum = np.abs(fshift)
    
    # 4. 构建坐标网格，计算每个像素到中心的距离 (半径)
    y, x = np.indices(magnitude_spectrum.shape)
    center = np.array(magnitude_spectrum.shape) // 2
    r = np.sqrt((x - center[1])**2 + (y - center[0])**2)
    r = r.astype(int)
    
    # 5. 径向平均 (Azimuthal Integration)
    # 使用 bincount 快速计算每个半径下的平均值
    tbin = np.bincount(r.ravel(), magnitude_spectrum.ravel())
    nr = np.bincount(r.ravel())
    
    # 避免除以0
    radial_profile = tbin / np.maximum(nr, 1)
    
    # 归一化处理，使 DC 分量 (0频率) 为 1，方便对比
    if radial_profile[0] != 0:
        radial_profile = radial_profile / radial_profile[0]
        
    return radial_profile

def get_cutoff_frequency(profile, threshold=1e-6):
    """
    寻找曲线下降到几乎为零（阈值）的位置
    """
    # 找到所有小于阈值的索引
    indices = np.where(profile < threshold)[0]
    
    if len(indices) > 0:
        # 返回第一个低于阈值的点的索引 (频率)
        return indices[0]
    else:
        # 如果从未降到阈值以下（比如全图都是高频噪声），则返回最大频率
        return len(profile)

# ==========================================
# 主程序
# ==========================================

# 1. 获取图像数据
# gt, baseline, ours = create_dummy_data()

# 读取图片
gt = np.array(Image.open("E:\\CJM\\datasets\\eval\\3dgs\\m19\\rubble200_default\\test\\ours_30000\\gt\\00006.png"))
algo_3dgs = np.array(Image.open("E:\\CJM\\datasets\\eval\\3dgs\\m19\\rubble200_default\\test\\ours_30000\\renders\\00006.png"))
algo_scaffold_gs = np.array(Image.open("E:\\CJM\\datasets\\eval\\scaffold_gs\\m19\\rubble200_default_1\\test\\ours_30000\\renders\\00006.png"))

# 2. 计算各自的频谱曲线
profile_gt = compute_radial_profile(gt)
profile_algo_3dgs = compute_radial_profile(algo_3dgs)
profile_algo_scaffold_gs = compute_radial_profile(algo_scaffold_gs)

cutoff_freq = get_cutoff_frequency(profile_gt)
# 3. 添加一点缓冲空间 (Buffer)，比如多显示 10%，让曲线末端不贴边
x_limit = int(cutoff_freq * 1.1)
# 确保不超过最大频率 (Nyquist)
x_limit = min(x_limit, len(profile_gt))

# 3. 绘图
plt.figure(figsize=(10, 6))
x_axis = np.arange(len(profile_gt))

# 设置 Log 坐标轴：通常频谱能量差异巨大，用对数坐标才能看清高频差异
plt.yscale('log') 

plt.plot(x_axis, profile_gt, color='black', label='Ground Truth', linewidth=1)
plt.plot(x_axis, profile_algo_3dgs, color='blue', label='3DGS', linewidth=1)
plt.plot(x_axis, profile_algo_scaffold_gs, color='red', label='Scaffold-GS', linewidth=1)

# 美化图表
plt.title("Azimuthal Integration (Radial Power Spectrum) | m19/rubble200/00006", fontsize=14)
plt.xlabel("Spatial Frequency (Radius)", fontsize=12)
plt.ylabel("Log Power Spectrum (Normalized)", fontsize=12)
plt.legend(fontsize=12)
plt.grid(True, which="both", ls="-", alpha=0.2)

# 限制 X 轴范围，通常只看 0 到 图像一半尺寸 (Nyquist 频率)
plt.xlim(0, x_limit) 

plt.show()