PAGES:=start 
TARGETS:=en cs

ALL_BUILDS:=$(foreach n,$(TARGETS),$(addsuffix _$(n).html,$(PAGES)))
DEBUG_BUILDS:=$(ALL_BUILDS:.html=_debug.html)

all: $(ALL_BUILDS) $(DEBUG_BUILDS)

clean: 
	rm -rf $(ALL_BUILDS) $(DEBUG_BUILDS)
	rm -rf $(ALL_BUILDS:.html=.css)
	rm -rf $(ALL_BUILDS:.html=.js) 
	rm -rf $(ALL_BUILDS:.html=.d)
	rm -rf $(DEBUG_BUILDS:.html=.d)

files:
	mkdir files
	
deps:
	mkdir deps

define RELEASE_template =
%_$(1).html: %.page | files deps;	wappbuild -pd "$${addprefix deps/,$$(@:.html=.d)}" -L $(1)_lang.csv -G $(1)_genlang.csv -c -B $$*_$(1) "$$<" 
endef

define DEBUG_template =
%_$(1)_debug.html: %.page | files deps;	wappbuild -pd "$${addprefix deps/,$$(@:.html=.d)}" -L $(1)_lang.csv -B $$*_$(1)_debug "$$<" 
endef

$(foreach n,$(TARGETS),$(eval $(call RELEASE_template,$(n))))
$(foreach n,$(TARGETS),$(eval $(call DEBUG_template,$(n))))


-include ${addprefix deps/,$(ALL_BUILDS:.html=.d)}
-include ${addprefix deps/,$(DEBUG_BUILDS:.html=.d)}







ifeq (a,b)



# use 'make TARGET=release all' to build release version





TARGET:=debug
FILES:=example.html
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
		../wappbuild -pd "$(@:.html=.d)" -l $(LANG).lang -D debug "$<"   
else
$(LANG)/%.html : %.page | $(LANG)
		../wappbuild -pd "$(@:.html=.d)" -l $(LANG).lang -c -D $(LANG)  "$<"

endif		

clean:
	rm -f $(OUTPUTS)
	rm -f $(OUTPUTS:.html=.css)
	rm -f $(OUTPUTS:.html=.js)
	rm -f $(OUTPUTS:.html=.d)
	
endif