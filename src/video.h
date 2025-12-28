#ifndef VIDEO_H
#define VIDEO_H

#define VIDEO_MEM ((unsigned short far*)(((unsigned long)(0xB800) << 16) | (0x0000)))

void flip_buffer();

void clear_hidden_buffer(unsigned char attribute);

#endif
