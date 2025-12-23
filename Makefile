# Target platform: dos | windows | nt
TARGET = dos

CC = wcl
CFLAGS = -bt=$(TARGET)

SRC = src/main.c src/video.c
OUT = gasbag.exe

all: $(OUT)

$(OUT):
    $(CC) $(CFLAGS) $(SRC) -fe=$(OUT)

clean:
    @rm -f *.obj *.exe
