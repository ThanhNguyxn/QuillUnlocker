from PIL import Image
import sys

def remove_white_bg(input_path, output_path):
    img = Image.open(input_path)
    img = img.convert("RGBA")
    datas = img.getdata()

    newData = []
    for item in datas:
        # If pixel is white (or very close to white), make it transparent
        if item[0] > 240 and item[1] > 240 and item[2] > 240:
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)

    img.putdata(newData)
    
    # Crop to content if needed, but let's keep it simple first
    img.save(output_path, "PNG")
    print(f"Saved transparent image to {output_path}")

if __name__ == "__main__":
    input_file = r"C:\Users\Admin\.gemini\antigravity\brain\0f7b0edc-834e-4cd2-8228-1047d0d4f028\quillunlocker_solid_bg_1767421907701.png"
    output_file = r"d:\Code\QuillUnlocker\logo.png"
    remove_white_bg(input_file, output_file)
