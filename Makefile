
# use 'make TARGET=release all' to build release version

TARGET:=debug
FILES:=index.html
LANG:=en


ifeq ($(TARGET),debug)
OUTPUTS=$(addprefix debug/,$(FILES))
else
OUTPUTS=$(addprefix $(LANG)/,$(FILES))
endif


-include $(OUTPUTS:.html=.d)

all : $(OUTPUTS)

debug:
	@echo "Use 'make TARGET=release all' to build release version"
	@mkdir debug

$(LANG):
	@mkdir $(LANG)


ifeq ($(TARGET),debug)
debug/%.html : %.page | debug
		wappbuild -pd "$(@:.html=.d)" -l $(LANG).lang -D debug "$<"   
else
$(LANG)/%.html : %.page | $(LANG)
		wappbuild -pd "$(@:.html=.d)" -l $(LANG).lang -c -D $(LANG)  "$<"

endif		

clean:
	rm -f $(OUTPUTS)
	rm -f $(OUTPUTS:.html=.css)
	rm -f $(OUTPUTS:.html=.js)
	rm -f $(OUTPUTS:.html=.d)
	