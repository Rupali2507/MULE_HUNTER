package com.mulehunter.backend.config;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.deser.std.StdDeserializer;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.temporal.ChronoField;

public class FlexibleLocalDateTimeDeserializer extends StdDeserializer<LocalDateTime> {

    private static final DateTimeFormatter OFFSET_FMT =
            DateTimeFormatter.ISO_OFFSET_DATE_TIME;   // handles +00:00, Z, +05:30 …

    private static final DateTimeFormatter LOCAL_FLEX =
            new DateTimeFormatterBuilder()
                .appendPattern("yyyy-MM-dd'T'HH:mm:ss")
                .optionalStart()
                    .appendFraction(ChronoField.NANO_OF_SECOND, 0, 9, true)
                .optionalEnd()
                .toFormatter();

    public FlexibleLocalDateTimeDeserializer() { super(LocalDateTime.class); }

    @Override
    public LocalDateTime deserialize(JsonParser p, DeserializationContext ctx)
            throws IOException {

        String raw = p.getText().trim();

        // 1. Has offset (+00:00, Z, +05:30 …) → parse as OffsetDateTime, drop offset
        try {
            return OffsetDateTime.parse(raw, OFFSET_FMT).toLocalDateTime();
        } catch (Exception ignored) {}

        // 2. No offset, plain LocalDateTime (e.g. "2025-12-16T11:33:23.578092")
        try {
            return LocalDateTime.parse(raw, LOCAL_FLEX);
        } catch (Exception ignored) {}

        throw new IOException("Cannot parse timestamp: " + raw);
    }
}