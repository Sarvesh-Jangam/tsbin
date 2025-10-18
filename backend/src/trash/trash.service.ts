import { HttpException, Injectable } from '@nestjs/common';
import { CreateTrashDto } from './dto/create-trash.dto';
import { UpdateTrashDto } from './dto/update-trash.dto';
import { AppwriteService } from 'src/appwrite/appwrite.service';
import { TelegramService } from 'src/telegram/telegram.service';
import { generateId } from 'src/lib/utils';
import { ErrorResponse } from 'src/lib/exception-filter';

@Injectable()
export class TrashService {
  constructor(
    private readonly appwriteService: AppwriteService,
    private readonly telegramService: TelegramService,
  ) {}

  async create(createTrashDto: CreateTrashDto) {
    const {
      type,
      encryptedContent,
      encryptedFiles,
      meta,
      passcodeHash,
      expireAt,
    } = createTrashDto;

    if (type === 'text') {
      return this.createTextTrash({
        encryptedContent,
        meta,
        passcodeHash,
        expireAt,
      });
    } else if (type === 'file') {
      return this.createFileTrash({
        encryptedFiles,
        passcodeHash,
        expireAt,
      });
    } else {
      throw new Error('Unsupported trash type');
    }
  }

  private async createTextTrash({
    encryptedContent,
    meta,
    passcodeHash,
    expireAt,
  }: {
    encryptedContent?: string;
    meta?: any;
    passcodeHash: string;
    expireAt?: Date;
  }) {
    if (!encryptedContent || !meta || !passcodeHash) {
      throw new Error(
        'Missing required fields: encryptedContent, meta, passcodeHash',
      );
    }

    const slug = generateId('ts');

    const data = {
      type: 'text',
      content: encryptedContent,
      encryption_meta: JSON.stringify(meta),
      passcode_hash: passcodeHash,
      encrypted: passcodeHash !== '0000',
      slug,
      views: 0,
      expires_at: expireAt || null,
      size: encryptedContent.length,
      message_ids: [], // Not used for text
      chat_id: '', // Not used for text
    };

    try {
      const rec = await this.appwriteService.getDb().createRow({
        rowId: slug,
        data: data,
        databaseId: this.appwriteService.getDatabaseId(),
        tableId: 'trash',
      });
      return rec.slug;
    } catch (error) {
      console.log(error);
      throw new ErrorResponse(
        `BAAS: Failed to create text trash - ${error.message}`,
        500,
      );
    }
  }

  private async createFileTrash({
    encryptedFiles,
    passcodeHash,
    expireAt,
  }: {
    encryptedFiles?: Array<{
      encryptedContent: string;
      meta: any;
    }>;
    passcodeHash: string;
    expireAt?: Date;
  }) {
    if (!encryptedFiles || encryptedFiles.length === 0) {
      throw new Error('encryptedFiles is required for file type');
    }

    const slug = generateId('ts');
    const fileMetadata: Array<{
      message_id: number;
      file_id: string;
      meta: any;
      originalSize: number;
    }> = [];
    let totalSize = 0;

    try {
      // Upload each encrypted file to Telegram
      for (const encryptedFile of encryptedFiles) {
        const { encryptedContent, meta } = encryptedFile;

        // Convert base64 encrypted content back to buffer for Telegram
        const fileBuffer = Buffer.from(encryptedContent, 'base64');
        totalSize += fileBuffer.length;

        // Upload to Telegram with original filename
        const uploadResult = await this.telegramService.uploadFile(
          fileBuffer,
          meta.fileName,
          `Encrypted file: ${meta.fileName} (Size: ${meta.fileSize} bytes)`,
        );

        fileMetadata.push({
          message_id: uploadResult.message_id,
          file_id: uploadResult.file_id,
          meta: meta,
          originalSize: meta.fileSize,
        });
      }

      // Store file metadata in database
      const data = {
        type: 'file',
        content: JSON.stringify({
          files: fileMetadata,
        }),
        encryption_meta: JSON.stringify({
          algorithm: 'AES-GCM',
          fileCount: encryptedFiles.length,
        }),
        passcode_hash: passcodeHash,
        encrypted: passcodeHash !== '0000',
        slug,
        views: 0,
        expires_at: expireAt || null,
        size: totalSize,
        message_ids: fileMetadata.map((f) => f.message_id),
        chat_id: '',
      };

      const rec = await this.appwriteService.getDb().createRow({
        rowId: slug,
        data: data,
        databaseId: this.appwriteService.getDatabaseId(),
        tableId: 'trash',
      });

      return rec.slug;
    } catch (error) {
      throw new ErrorResponse(
        `BAAS: Failed to create file trash - ${error.message}`,
        500,
      );
    }
  }

  findAll() {
    return {
      message: `Not implemented yet`,
      data: [],
    };
  }

  async findOne(slug: string) {
    try {
      const rows = await this.appwriteService.getDb().getRow({
        databaseId: this.appwriteService.getDatabaseId(),
        tableId: 'trash',
        rowId: slug,
      });

      const trash = rows;

      // Increment view count
      await this.appwriteService.getDb().updateRow({
        databaseId: this.appwriteService.getDatabaseId(),
        tableId: 'trash',
        rowId: trash.$id,
        data: { views: trash.views + 1 },
      });

      if (trash.expires_at && new Date(trash.expires_at) < new Date()) {
        throw new HttpException('Trash has expired', 410);
      }

      const result = {
        id: trash.$id,
        slug: trash.slug,
        type: trash.type,
        content: trash.content,
        encryption_meta: trash.encryption_meta
          ? JSON.parse(trash.encryption_meta)
          : null,
        encrypted: trash.encrypted,
        passcode_hash: trash.passcode_hash,
        views: trash.views + 1,
        expires_at: trash.expires_at,
        size: trash.size,
        created_at: trash.$createdAt,
      };

      // If it's a file type, fetch the encrypted files from Telegram
      if (trash.type === 'file' && trash.content) {
        const fileData = JSON.parse(trash.content);
        const encryptedFiles: any[] = [];

        if (fileData.files && Array.isArray(fileData.files)) {
          for (const fileInfo of fileData.files) {
            try {
              // Download the encrypted file content from Telegram using file_id
              const encryptedFileBuffer = await this.telegramService.getFile(
                fileInfo.file_id,
              );

              // Convert buffer to base64 string
              const encryptedContent = encryptedFileBuffer.toString('base64');

              encryptedFiles.push({
                meta: fileInfo.meta,
                messageId: fileInfo.message_id,
                encryptedContent: encryptedContent,
              });
            } catch (error) {
              console.error(
                `Failed to fetch file for message ${fileInfo.message_id}:`,
                error,
              );
              // Still add the file info without content so frontend knows it exists
              encryptedFiles.push({
                meta: fileInfo.meta,
                messageId: fileInfo.message_id,
                encryptedContent: null,
                error: 'Failed to fetch file content',
              });
            }
          }
        }

        result['encryptedFiles'] = encryptedFiles;
      }

      return result;
    } catch (error) {
      console.error(error);
      throw new HttpException('Failed to retrieve trash', 500);
    }
  }

  update(id: number, updateTrashDto: UpdateTrashDto) {
    return `This action updates a #${id} trash`;
  }

  remove(id: number) {
    return `This action removes a #${id} trash`;
  }
}
